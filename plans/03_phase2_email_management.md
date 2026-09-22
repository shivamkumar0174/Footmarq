# Phase 2 — Multi-Email Management

> Most people have 2–4 email addresses.
> My_Login is the first tool that treats all of them as a unified identity.

---

## Objective

Allow users to add, verify, and manage multiple email addresses under a single My_Login account. Each email becomes an independent discovery source with its own scan history, account list, and privacy controls.

---

## 2.1 — Why Multi-Email Matters

A typical user has:
- `personal@gmail.com` → social, entertainment, shopping accounts
- `work@company.com` → SaaS tools, productivity apps
- `old@hotmail.com` → forgotten accounts from 10 years ago

Without multi-email support, My_Login misses a huge portion of their digital footprint.

---

## 2.2 — Email Identity Model

```
User Account (My_Login)
│
├── Primary Email: harshit@gmail.com ✅ Verified | Gmail Connected
│   ├── 42 accounts discovered
│   ├── Last scan: 2 hours ago
│   └── 2 breaches
│
├── Work Email: harshit@company.com ✅ Verified | No Gmail
│   ├── 18 accounts discovered
│   ├── Last scan: Never (Gmail not connected)
│   └── 0 breaches
│
└── Old Email: old@hotmail.com ⚠️ Unverified
    ├── Cannot scan (unverified)
    └── Breach check only (HIBP)
```

---

## 2.3 — Add Email Flow

### Step 1: User enters email
```
POST /api/v1/emails
{ "email": "harshit@company.com" }
```

### Step 2: Validation
- Not already added to this account
- Not the same as primary email
- Max 5 additional emails per user (prevent abuse)

### Step 3: Verification
- Send 6-digit OTP to the entered email address
- OTP expires in 15 minutes

### Step 4: Verify OTP
```
POST /api/v1/emails/{email_id}/verify
{ "otp": "847291" }
```

### Step 5: Email added successfully
- Email is now listed in the user's email manager
- Breach check is immediately triggered for this email
- Gmail connection is offered (if Gmail address)

---

## 2.4 — Email States

| State | Description | Actions Available |
|---|---|---|
| `unverified` | OTP not yet confirmed | Resend OTP, Delete |
| `verified` | OTP confirmed | Connect Gmail, Breach check, Delete |
| `gmail_connected` | Gmail OAuth granted | Scan, Rescan, Disconnect, Delete |
| `scanning` | Gmail scan in progress | View progress |
| `scan_complete` | Scan finished | View accounts, Rescan |
| `scan_error` | Gmail API error | Retry, Disconnect |

---

## 2.5 — Gmail Connection Per Email

Each Gmail address can independently have Gmail connected or not. Non-Gmail addresses (Outlook, Yahoo, etc.) cannot use Gmail scan — breach check is still available for all verified addresses.

### Connecting Gmail
```
GET /api/v1/emails/{email_id}/gmail/connect
```
→ Redirects to Google OAuth with Gmail read scope

### Disconnecting Gmail
```
DELETE /api/v1/emails/{email_id}/gmail
```
- Revokes OAuth token from Google
- Deletes stored OAuth tokens
- Marks Gmail status as disconnected
- Does NOT delete already-discovered accounts
- Does NOT delete scan history

---

## 2.6 — Per-Email Privacy Controls

Each email has independent controls:

```json
{
  "email_id": "uuid",
  "email": "harshit@gmail.com",
  "privacy": {
    "include_in_breach_check": true,
    "include_in_digital_footprint": true,
    "share_in_analytics": false,
    "auto_scan_enabled": true,
    "scan_frequency": "weekly"    // "daily" | "weekly" | "monthly" | "manual"
  }
}
```

---

## 2.7 — Scan Management

### Manual Scan Trigger
```
POST /api/v1/emails/{email_id}/scan
```
- Enqueues a Gmail scan job
- Returns `{ job_id: "uuid", status: "queued" }`

### Scan Status
```
GET /api/v1/emails/{email_id}/scan/status
```
```json
{
  "status": "in_progress",
  "progress_percent": 47,
  "emails_processed": 2340,
  "accounts_found_so_far": 18,
  "started_at": "2026-08-12T10:00:00Z",
  "estimated_completion": "2026-08-12T10:08:00Z"
}
```

### Scan History
```
GET /api/v1/emails/{email_id}/scans
```
```json
[
  {
    "id": "uuid",
    "status": "completed",
    "started_at": "2026-08-12T08:00:00Z",
    "completed_at": "2026-08-12T08:09:00Z",
    "emails_processed": 5823,
    "accounts_discovered": 3,
    "accounts_updated": 7,
    "duration_seconds": 540
  }
]
```

---

## 2.8 — Remove Email

```
DELETE /api/v1/emails/{email_id}
```

### Behavior
- Cannot delete primary email (must change primary first)
- Revokes Gmail OAuth if connected
- Deletes all scan data for that email
- Does NOT delete the user's `accounts` records by default
- Shows confirmation dialog: "This will remove X accounts associated with this email. Continue?"
- User can choose to keep or delete associated accounts

---

## 2.9 — Database Schema

```sql
-- user_emails
CREATE TABLE user_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  verification_otp VARCHAR(10),
  verification_otp_expires_at TIMESTAMPTZ,
  otp_attempts INT DEFAULT 0,
  gmail_connected BOOLEAN DEFAULT false,
  gmail_access_token TEXT,            -- encrypted at rest
  gmail_refresh_token TEXT,           -- encrypted at rest
  gmail_token_expires_at TIMESTAMPTZ,
  gmail_scopes TEXT[],
  last_scan_at TIMESTAMPTZ,
  scan_status VARCHAR(50) DEFAULT 'never_scanned',
  auto_scan_enabled BOOLEAN DEFAULT true,
  scan_frequency VARCHAR(20) DEFAULT 'weekly',
  include_in_breach_check BOOLEAN DEFAULT true,
  include_in_footprint BOOLEAN DEFAULT true,
  share_in_analytics BOOLEAN DEFAULT false,
  total_accounts_discovered INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

-- email_scans (scan history)
CREATE TABLE email_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email_id UUID REFERENCES user_emails(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,        -- queued | in_progress | completed | failed
  trigger VARCHAR(50) DEFAULT 'manual', -- manual | scheduled | initial
  emails_processed INT DEFAULT 0,
  accounts_discovered INT DEFAULT 0,
  accounts_updated INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 2.10 — UI Design

### Email Manager Page

```
My Emails

[+ Add Email]

● harshit@gmail.com                         ✅ Gmail Connected
  42 accounts · Last scan 2 hours ago
  [Rescan]  [Disconnect Gmail]  [Settings]  [Remove]

○ harshit@company.com                       ✅ Verified
  18 accounts · No Gmail connection
  [Connect Gmail]  [Settings]  [Remove]

○ old@hotmail.com                           ⚠️ Unverified
  Verify to enable scanning
  [Verify Now]  [Remove]
```

---

## Acceptance Criteria

- [ ] User can add up to 5 additional email addresses
- [ ] OTP verification works with 15-minute expiry
- [ ] Verified email immediately triggers breach check
- [ ] Gmail can be connected per-email via OAuth
- [ ] Gmail can be disconnected, revoking OAuth at Google
- [ ] Scan can be triggered manually and status polled in real-time
- [ ] Scan history is recorded and viewable
- [ ] Email can be removed, with choice to keep or delete associated accounts
- [ ] Per-email privacy controls are respected
- [ ] Primary email cannot be removed
