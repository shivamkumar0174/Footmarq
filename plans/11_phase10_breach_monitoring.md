# Phase 8 — Breach Monitoring

> **Tier 1 MVP phase.** Weekly automated breach checks and on-demand manual checks using HIBP — simple, reliable, and extensible via the BreachProvider interface.

---

## Goal

Automatically detect when a user's email addresses appear in known data breaches, link each breach to the specific discovered service account, and alert users with clear action steps.

---

## MVP Scope

```
✅ Manual breach check (on-demand, user-triggered)
✅ Initial check on email verification / Gmail connect
✅ Weekly scheduled check for all verified emails
✅ Breach-to-account linking via service domain
✅ User "Mark Resolved" flow
❌ Hourly polling for new HIBP breaches (add later)
❌ Real-time breach webhook (add later)
❌ Automated re-scanning on new breach publication (add later)
```

Weekly checks are sufficient for MVP. The frequency can be increased when user count and API costs are understood.

---

## Features

### 1. BreachProvider Interface (TypeScript)

```typescript
// breaches/providers/breach.provider.ts
export interface BreachRecord {
  name: string;
  domain: string;
  breachDate?: string;
  dataClasses: string[];
  isSensitive: boolean;
  isVerified: boolean;
  isFabricated: boolean;
}

export interface BreachProvider {
  checkEmail(email: string): Promise<BreachRecord[]>;
}
```

### 2. HIBP Implementation (TypeScript)

```typescript
// breaches/providers/hibp.provider.ts
export class HIBPBreachProvider implements BreachProvider {
  async checkEmail(email: string): Promise<BreachRecord[]> {
    const res = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
      {
        headers: {
          'hibp-api-key': process.env.HIBP_API_KEY!,
          'User-Agent': 'My_Login/1.0 (mylogin.app)',
        },
      }
    );
    if (res.status === 404) return [];   // No breaches — not an error
    if (!res.ok) throw new Error(`HIBP API error: ${res.status}`);
    return res.json();
  }
}
```

Swapping to a different provider later requires only writing a new class that implements `BreachProvider` — no other code changes.

### 3. Breach Check Trigger Events

| Trigger | When | Queue |
|---|---|---|
| Email verified | After OTP verification | `breach` (immediate) |
| Gmail connected | After OAuth callback | `breach` (immediate) |
| Manual scan | User taps "Check for breaches" | `breach` (immediate) |
| Weekly sweep | Monday 01:00 UTC (BullMQ repeated job) | `breach` |

> **Not in MVP:** Hourly polling for newly published breaches. Weekly sweep is sufficient and dramatically cheaper.

### 4. Breach Processing Pipeline

```typescript
// breaches/breaches.service.ts
export async function processBreachResults(
  userEmailId: string,
  records: BreachRecord[]
): Promise<IBreach[]> {
  const userEmail = await UserEmail.findById(userEmailId);
  if (!userEmail) throw new AppError('EMAIL_NOT_FOUND', 404);

  const newlyDetected: IBreach[] = [];

  for (const record of records) {
    // Idempotent: compound unique index prevents duplicates
    const existing = await Breach.findOne({
      userId: userEmail.userId,
      hibpBreachName: record.name,
    });
    if (existing) continue;

    // Match breach domain to a discovered service and account
    const service = await Service.findOne({ domains: record.domain });
    let accountId: mongoose.Types.ObjectId | undefined;
    if (service) {
      const account = await Account.findOne({
        userEmailId,
        serviceId: service._id,
      });
      if (account) accountId = account._id;
    }

    const breach = await Breach.create({
      userEmailId,
      userId: userEmail.userId,
      accountId,
      hibpBreachName: record.name,
      breachDomain: record.domain,
      breachDate: record.breachDate ? new Date(record.breachDate) : undefined,
      dataClasses: record.dataClasses,
      isSensitive: record.isSensitive,
      isVerified: record.isVerified,
      isFabricated: record.isFabricated,
    });

    newlyDetected.push(breach);

    // Sync account breach state (derived cache)
    if (accountId) {
      await syncAccountBreachState(accountId.toString());
    }
  }

  return newlyDetected;
}
```

### 5. "Mark as Resolved" Flow

When the user confirms they've secured the account:

```typescript
export async function resolveBreach(breachId: string, userId: string): Promise<void> {
  const breach = await Breach.findOne({ _id: breachId, userId });
  if (!breach) throw new AppError('BREACH_NOT_FOUND', 404);

  breach.isResolved = true;
  breach.resolvedAt = new Date();
  await breach.save();

  // Sync account breach state (may clear isBreached if all breaches resolved)
  if (breach.accountId) {
    await syncAccountBreachState(breach.accountId.toString());
  }
}
```

> `accounts.is_breached` is only cleared when ALL linked breaches for that account are resolved. One resolved breach doesn't clear the flag if others remain.

### 6. Breach History UI

```
user@gmail.com — Breach History

🔴 Active (2)
   Dropbox        Aug 2016   Passwords, Email    [ Change Password → ] [ Mark Resolved ]
   MyOldForum     Mar 2021   Email               [ Mark Resolved ]

✅ Resolved (1)
   Adobe          Oct 2013   Email, Password hints   Resolved 3 days ago
```

---

## Database Changes

```sql
CREATE TABLE breaches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email_id     UUID REFERENCES user_emails(id) ON DELETE CASCADE,
  account_id        UUID REFERENCES accounts(id) ON DELETE SET NULL,
  hibp_breach_name  VARCHAR(100) NOT NULL,
  breach_domain     VARCHAR(255),
  breach_date       DATE,
  data_classes      TEXT[],
  is_sensitive      BOOLEAN DEFAULT false,
  is_verified       BOOLEAN DEFAULT true,
  is_fabricated     BOOLEAN DEFAULT false,
  is_resolved       BOOLEAN DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  first_detected_at TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email_id, hibp_breach_name)
);
```

---

## API Changes

```
GET  /api/v1/breaches                     → all breaches for current user
GET  /api/v1/breaches/{email_id}          → breaches per email address
POST /api/v1/breaches/check/{email_id}    → trigger manual breach check
PATCH /api/v1/breaches/{breach_id}/resolve → mark breach resolved
```

---

## Background Jobs

```
breaches.check_email            (breach queue — on trigger)
breaches.schedule_weekly_checks (breach queue — BullMQ repeated job, Monday 01:00 UTC)
```

---

## Dependencies

- Phase 2 (Email Identity) — `user_emails` table
- Phase 5 (Service Catalog) — domain lookup to link breach to account
- Phase 9 (Risk & Security Center) — breach state triggers risk recalculation

---

## What Is Intentionally NOT Implemented

```
❌ Hourly new-breach polling (weekly is sufficient for MVP)
❌ Real-time breach webhook from HIBP
❌ Multiple breach providers active simultaneously (one at a time via interface)
❌ BreachDirectory / Dehashed integration (add via BreachProvider interface if needed)
❌ Breach notification beyond in-app + email (no Push in MVP)
❌ Automated breach response suggestions (advisory text only)
```

---

## Cost / Complexity Considerations

- HIBP API: ~$3.50/month for an API key. At 1,000 users with 2 emails each = 2,000 checks/week = well within rate limits.
- Weekly checking instead of hourly = 168× fewer API calls.
- `UNIQUE(user_email_id, hibp_breach_name)` makes the check idempotent at the DB level — no complex dedup logic.
- The `BreachProvider` interface means the entire provider can be swapped in minutes if HIBP changes terms.

---

## Acceptance Criteria

- [ ] HIBP check runs immediately on email verification and Gmail connect.
- [ ] Weekly BullMQ repeatable job fans out to all verified emails every Monday.
- [ ] `UNIQUE(user_email_id, hibp_breach_name)` prevents duplicate breach records.
- [ ] Breach domain matched against `service_domains` to link breach to account.
- [ ] Unlinked breaches (unknown domain) are still recorded with `account_id = NULL`.
- [ ] New breach detection triggers in-app notification and email alert within 5 minutes.
- [ ] `accounts.is_breached` is only set via `sync_account_breach_state()` — never directly.
- [ ] "Mark Resolved" clears `is_breached` only when ALL linked breaches for that account are resolved.
- [ ] `BreachProvider` protocol used — no direct HIBP HTTP calls outside `HIBPBreachProvider`.
