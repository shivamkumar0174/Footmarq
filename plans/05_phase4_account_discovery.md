# Phase 4 — Account Discovery Engine

> The engine that transforms raw email metadata into a structured, deduplicated account inventory.

---

## Objective

Analyze email metadata extracted from Gmail to identify third-party services, classify event types, deduplicate entries, and build a clean account inventory — starting with deterministic rules before introducing ML in Phase 17.

---

## 4.1 — Discovery Pipeline (End-to-End)

```
Raw Email Metadata (sender, subject, date, message_id)
                          │
                          ▼
              ┌───────────────────────┐
              │  1. Pre-Filter        │  Discard: newsletters, ads, social
              │     (Blocklist)       │  Keep:   transactional / account emails
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  2. Service Catalog   │  Exact sender domain → service_id
              │     Lookup            │  (e.g. no-reply@github.com → GitHub)
              └───────────┬───────────┘
                          │
                    Match? ├── YES → High confidence (90–100%)
                          │
                          ▼ NO
              ┌───────────────────────┐
              │  3. Rule-Based        │  Subject regex + domain heuristics
              │     Pattern Matcher   │  (e.g. "Welcome to X" pattern)
              └───────────┬───────────┘
                          │
                    Match? ├── YES → Medium confidence (70–89%)
                          │
                          ▼ NO
              ┌───────────────────────┐
              │  4. Generic Signal    │  Known transactional keywords:
              │     Detector          │  "verify", "confirm", "activate"
              └───────────┬───────────┘
                          │
                    Match? ├── YES → Low confidence (50–69%)
                          │
                          ▼ NO
                  Discard (< 50% confidence)
                          │
                          ▼ (All matched paths)
              ┌───────────────────────┐
              │  5. Event Classifier  │  Classify event type:
              │                       │  SIGNUP / TRANSACTION / etc.
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  6. Normalizer        │  Map service variants to
              │                       │  canonical service_id
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  7. Deduplication     │  message_id check → skip if seen
              │     Engine            │  Account merge by (email_id, service_id)
              └───────────┬───────────┘
                          │
                          ▼
                   Database Persistence
              (accounts + account_events tables)
```

---

## 4.2 — Pre-Filter: Blocklist

Before any detection runs, emails matching these criteria are discarded immediately to avoid noise and reduce processing cost:

### Sender Domain Blocklist (Bulk/Marketing Senders)
```python
BLOCKLIST_DOMAINS = {
    "mailchimp.com", "sendgrid.net", "constantcontact.com",
    "klaviyo.com", "marketo.com", "hubspot.com",
    "bounce.linkedin.com",   # LinkedIn marketing (not account)
    "marketing.amazon.com",  # Amazon promotions (not transactions)
}
```

### Subject Blocklist Patterns
```python
BLOCKLIST_SUBJECT_PATTERNS = [
    r"unsubscribe",
    r"limited time offer",
    r"% off",
    r"sale ends",
    r"you may have missed",
    r"newsletter",
    r"weekly digest",
]
```

---

## 4.3 — Rule-Based Pattern Matcher

In Phase 4, detection is deterministic. Rules are evaluated in priority order:

| Priority | Match Type | Example | Service Resolution | Confidence |
|---|---|---|---|---|
| 1 | **Exact sender domain** | `@spotify.com` | Catalog lookup | 99% |
| 2 | **Subdomain of known domain** | `@notifications.github.com` | Strip subdomain → `github.com` | 97% |
| 3 | **Subject regex + domain** | `"Welcome to GitHub"` + `@github.com` | Cross-validated | 95% |
| 4 | **Subject regex capture** | `"Welcome to (.+)!"` | Extracted service name | 85% |
| 5 | **Subject regex capture** | `"Verify your (.+) account"` | Extracted service name | 80% |
| 6 | **Generic transactional** | Contains "activate", "confirm", "verify" | Domain-only match | 60% |

### Key Regex Patterns
```python
SUBJECT_PATTERNS = [
    # Registration
    (r"welcome to (?P<service>.+?)[\s!,]", "SIGNUP", 85),
    (r"thanks for (?:joining|signing up)(?: for)? (?P<service>.+?)[\s!,]", "SIGNUP", 82),
    (r"your (?P<service>.+?) account (?:is ready|has been created)", "SIGNUP", 80),
    (r"confirm your (?P<service>.+?) (?:email|account)", "SIGNUP", 78),
    (r"verify your (?:email for )?(?P<service>.+?)[\s!,]", "SIGNUP", 75),

    # Authentication / Security
    (r"new sign.in to (?P<service>.+)", "LOGIN_ALERT", 90),
    (r"security alert(?: for| from)? (?P<service>.+?)", "SECURITY_ALERT", 88),
    (r"password (?:reset|changed) for (?P<service>.+?)", "PASSWORD_RESET", 90),

    # Transactions
    (r"receipt for your (?P<service>.+?) (?:purchase|subscription)", "TRANSACTION", 92),
    (r"your (?P<service>.+?) subscription (?:is active|has been renewed)", "TRANSACTION", 88),
]
```

---

## 4.4 — Event Classification

Every matched email is classified into one of these event types:

| Event Type | Description | Example Trigger |
|---|---|---|
| `SIGNUP` | First account creation | "Welcome to Spotify!" |
| `EMAIL_VERIFY` | Email confirmation request | "Confirm your email address" |
| `LOGIN_ALERT` | New device / suspicious login | "New sign-in from Chrome on Linux" |
| `PASSWORD_RESET` | Password change request | "Reset your GitHub password" |
| `SECURITY_ALERT` | General security notice | "Unusual activity detected" |
| `TRANSACTION` | Purchase / invoice / subscription | "Receipt for your Netflix subscription" |
| `SUBSCRIPTION` | Subscription confirmation/change | "Your Pro plan is now active" |
| `ACCOUNT_UPDATE` | Profile / settings change | "Your email address has been updated" |
| `GENERAL` | Catch-all for unclassified account emails | — |

---

## 4.5 — Normalization: Variant → Canonical Service

Multiple sender addresses can map to the same service:

```python
SERVICE_DOMAIN_MAP = {
    # Amazon variants
    "amazon.com": "amazon",
    "amazon.co.uk": "amazon",
    "amazon.in": "amazon",
    "amazon.de": "amazon",
    "orders.amazon.com": "amazon",
    "auto-confirm.amazon.com": "amazon",

    # Google variants
    "accounts.google.com": "google",
    "no-reply@google.com": "google",
    "mail-noreply@google.com": "google",

    # GitHub variants
    "notifications.github.com": "github",
    "noreply@github.com": "github",
}
```

---

## 4.6 — Deduplication Engine

Deduplication operates at two levels:

### Level 1 — Message-Level (Exact Duplicate)
- Check `message_id` in `account_events` before inserting.
- If found → skip entirely (idempotent scan behavior).

### Level 2 — Account-Level (Service Merge)
- Check if `(user_email_id, service_id)` already exists in `accounts`.
- **If EXISTS**: Update `last_activity_at` if the new event is more recent. Increment event count. Add new `account_events` row.
- **If NOT EXISTS**: Create new `accounts` row with `first_detected_at = email.timestamp`.

### Multi-Email Identity Handling
- If `user@gmail.com` AND `user@outlook.com` both received signup emails from Spotify → Two separate `accounts` records, both linked to the user but different `user_email_id`.
- They appear as distinct entries in the dashboard under their respective email tabs.

---

## 4.7 — Confidence Thresholds & User Actions

| Confidence | Label | Auto-Add | User Action Required |
|---|---|---|---|
| 90–100% | **Verified** | ✅ Yes | None |
| 70–89% | **Likely** | ✅ Yes | Optional: confirm in dashboard |
| 50–69% | **Uncertain** | ⚠️ Add to "Review" queue | Requires confirm or dismiss |
| < 50% | **Discarded** | ❌ No | Never shown |

"Review" queue is a dashboard section: *"We found these — are they yours?"*

---

## 4.8 — Database Schema

```sql
-- accounts: one row per (user_email, service) pair
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email_id UUID REFERENCES user_emails(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
  custom_service_name VARCHAR(100),     -- for unrecognized services
  custom_service_domain VARCHAR(255),
  confidence_score NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  confidence_label VARCHAR(20) DEFAULT 'verified', -- verified | likely | uncertain
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL,
  activity_status VARCHAR(20) DEFAULT 'active', -- active | dormant | inactive
  event_count INT DEFAULT 1,
  risk_score INT DEFAULT 0,
  risk_level VARCHAR(20) DEFAULT 'low',
  is_breached BOOLEAN DEFAULT false,
  two_factor_status VARCHAR(30) DEFAULT 'unknown',
  user_confirmed BOOLEAN DEFAULT true,  -- false if in review queue
  is_archived BOOLEAN DEFAULT false,    -- soft-delete for cleanup
  is_deleted_by_user BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email_id, service_id)
);

-- account_events: individual email events linked to an account
CREATE TABLE account_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  message_id VARCHAR(255) UNIQUE NOT NULL,  -- Gmail message ID (dedup key)
  thread_id VARCHAR(255),
  event_type VARCHAR(30) NOT NULL,          -- SIGNUP | TRANSACTION | etc.
  sender_email VARCHAR(255),
  sender_name VARCHAR(255),
  subject TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL,
  confidence_score NUMERIC(4,2),
  detection_method VARCHAR(30),             -- catalog | regex | generic
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_account_events_account_id ON account_events(account_id);
CREATE INDEX idx_account_events_message_id ON account_events(message_id);
CREATE INDEX idx_accounts_user_email_service ON accounts(user_email_id, service_id);
CREATE INDEX idx_accounts_risk_level ON accounts(risk_level);
CREATE INDEX idx_accounts_activity_status ON accounts(activity_status);
```

---

## 4.9 — Scan Performance Targets

| Metric | Target |
|---|---|
| Processing throughput | ≥ 100 messages / second per worker |
| Detection precision (top 200 services) | ≥ 95% |
| Detection recall (account emails correctly found) | ≥ 90% |
| False positive rate | ≤ 2% |
| Deduplication correctness | 100% (by message_id) |
| Scan time for 10,000 emails | ≤ 3 minutes (single worker) |

---

## Acceptance Criteria

- [ ] Pre-filter blocklist prevents newsletters and marketing emails from being processed.
- [ ] Exact sender domain match achieves ≥ 95% detection precision for cataloged services.
- [ ] `message_id` deduplication ensures idempotent scan behavior (rescanning produces no duplicates).
- [ ] Account merge correctly updates `last_activity_at` without creating duplicate `accounts` rows.
- [ ] Low-confidence (< 0.70) accounts are placed as `candidate` status, not auto-confirmed.
- [ ] `confirmed` confidence (0.85+) accounts are auto-added to the dashboard.
- [ ] `account_events` table records every individual email event with its classification.
- [ ] Scan checkpoint system persists progress every 500 messages (resilience against crashes).

---

## What Is Intentionally NOT Implemented

```
❌ ML-based account classification (rule-based only in MVP)
❌ Auto-IMAP / non-Gmail scanning (Gmail only in MVP)
❌ Email body parsing (metadata only: sender, subject, date)
❌ Real-time streaming scan (batch per-page via Gmail API)
❌ Scanning sent mail or drafts (inbox only)
❌ Scanning all time at once (paged, with checkpoint)
❌ Claiming to find "every account ever created" (only email evidence in connected mailbox)
```

---

## Cost / Complexity Considerations

- Rule-based pipeline has zero inference cost (vs ML which adds model serving cost).
- Gmail API free quota: 1 billion units/day. A full 10,000-email scan uses ~20,000 units — well within free tier.
- `message_id UNIQUE` index makes deduplication O(1) at the DB level.
- Checkpoint system means a crashed scan can resume from where it stopped — no need to reprocess thousands of messages.
- The candidate flow ensures no email evidence is discarded, building a self-improving catalog dataset passively.
