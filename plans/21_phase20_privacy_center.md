# Phase 11 — Privacy Foundation (MVP)

> **Tier 1 MVP phase.** Core privacy controls that must ship with the initial product — not later.

---

## Goal

Give users complete control over their data before asking them to trust My_Login with Gmail access. The essential privacy actions — disconnect Gmail, export data, delete data, and delete the account — are MVP requirements, not post-launch features.

---

## Features

### 1. Data Overview (What We Store)

A page showing exact counts of all stored data for this user:

```
WHAT WE STORE ABOUT YOU

Profile Data
  • Name, primary email, profile picture, account creation date

Connected Emails
  • N email addresses
  • N Gmail connections (OAuth active)
  • Scopes: gmail.readonly — read access to email metadata only

Discovered Accounts
  • N accounts found in connected mailboxes
  • N email events logged (sender, subject, date only — no body content)
  • 0 email body content stored

Security Data
  • N breach records
  • N security events

Scan History
  • N scans (metadata only: count, duration, timestamp)
  • Scan logs auto-purge after 30 days

Active Sessions
  • N sessions (device info, IP, last used)
```

### 2. OAuth Permissions Page

Shows exactly what Gmail scopes are active per connected email:

```
CONNECTED GMAIL PERMISSIONS

user@gmail.com
  Scope: gmail.readonly
  Granted: Read email metadata (sender, subject, date)
  NOT granted: Send email / Delete email / Manage labels
  Connected: 12 Aug 2026
  [ Revoke Gmail Access ]

user@company.com
  Scope: gmail.readonly
  [ Revoke Gmail Access ]
```

### 3. Revoke Gmail Access

When user clicks "Revoke Gmail Access":

```python
async def revoke_gmail_access(user_email_id: str, user_id: str):
    email = get_user_email(user_email_id, user_id)

    # 1. Call Google's OAuth revocation endpoint
    await revoke_google_token(email.gmail_access_token)

    # 2. Delete tokens from DB
    email.gmail_access_token = None
    email.gmail_refresh_token = None
    email.gmail_token_expires_at = None
    email.gmail_connected = False
    email.gmail_scopes = []
    db.commit()

    # 3. Log to audit_log
    log_audit(user_id, "GMAIL_REVOKED", {"email": email.email})
```

Revocation does NOT delete discovered accounts — only disconnects the Gmail scanning capability.

### 4. Data Export (GDPR Art. 20)

```
POST /api/v1/privacy/export
```

Queued as a `maintenance` BullMQ job. Generates:

```
mylogin_export_YYYY-MM-DD.zip
├── profile.json
├── emails.json
├── accounts.json
├── account_events.json         (sender, subject, date — no body)
├── breaches.json
├── security_events.json
└── README.txt                  (explains the data format)
```

User receives an email with a signed time-limited download link (24hr TTL).

### 5. Delete Scan Logs

Deletes all `email_scans` records and `account_events` rows while preserving the high-level account inventory:

```
POST /api/v1/privacy/purge-scan-logs
```

Requires confirmation dialog.

### 6. Delete My_Login Account (Full)

Permanent, irreversible. Requires typing `DELETE MY ACCOUNT` to confirm.

```typescript
async function deleteAccount(userId: string): Promise<void> {
  // 1. Revoke all Gmail tokens at Google
  const emails = await UserEmail.find({ userId });
  for (const email of emails) {
    if (email.gmailConnected && email.gmailAccessToken) {
      await revokeGoogleToken(email.gmailAccessToken);
    }
  }

  // 2. Cascade delete all user documents from MongoDB
  await UserEmail.deleteMany({ userId });
  await Account.deleteMany({ userId });
  await AccountEvent.deleteMany({ userId });
  await Breach.deleteMany({ userId });
  await Session.deleteMany({ userId });
  await RefreshToken.deleteMany({ userId });
  await User.findByIdAndDelete(userId);

  // 3. Flush user cache from Redis
  await invalidateUserCache(userId);

  // 4. Log (anonymized — no userId stored post-deletion)
  await AuditLog.create({ action: 'ACCOUNT_DELETED', metadata: { timestamp: new Date() } });
}
```

---

## Database Changes

No new tables required for MVP privacy. Uses existing tables.

Optional `auditLog` collection (already in DB architecture):

```typescript
// models/audit-log.schema.ts
const AuditLogSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User' },  // null for deleted users
  action:    { type: String, required: true },
  ipAddress: { type: String },
  metadata:  { type: Schema.Types.Mixed },
}, { timestamps: true });
```

---

## API Changes

```
GET  /api/v1/privacy/overview          → data counts per category
GET  /api/v1/privacy/permissions       → active OAuth scopes per email
POST /api/v1/privacy/gmail/{email_id}/revoke  → revoke Gmail, keep account data
POST /api/v1/privacy/export            → enqueue export (returns job_id)
GET  /api/v1/privacy/export/{job_id}   → check export status / download URL
POST /api/v1/privacy/purge-scan-logs   → delete scan + event records
DELETE /api/v1/privacy/account         → delete entire My_Login account
```

---

## Background Jobs

- `maintenance.generate_export` — generates ZIP, uploads to S3, emails signed link
- `maintenance.purge_expired_data` — runs daily, respects user retention settings

---

## Dependencies

- Phase 1 (Auth) — session/user context
- Phase 2 (Email Identity) — user_emails table
- Phase 3 (Gmail Integration) — token revocation
- Phase 4 (Discovery) — account/event tables to export/delete

---

## What Is Intentionally NOT Implemented in MVP

```
❌ Per-category retention duration controls (7/14/30/90 days — comes in Phase 15)
❌ GDPR compliance automation platform
❌ Consent engine / policy engine
❌ Data lineage tracking
❌ Dedicated compliance microservice
❌ Regulation-specific mode (EU vs US)
❌ Automated DPA (Data Processing Agreement) generation
❌ Privacy Shield or SCCs documentation
```

Advanced retention controls move to Phase 15 (Settings). The privacy architecture is designed correctly from day one — it's the UI surface that is simplified.

---

## Cost / Complexity Considerations

- **No new infrastructure** — all export generation uses existing BullMQ maintenance queue.
- **S3 cost for exports** is negligible (24hr TTL on signed links; objects cleaned by lifecycle rule).
- **Google revocation endpoint** is a single API call with no cost.
- Not building a compliance platform saves weeks of development.
- All legal obligations (GDPR Art. 15, 17, 20) are met by these 6 endpoints.

---

## Acceptance Criteria

- [ ] Data overview page shows accurate, real-time counts for all stored data categories.
- [ ] OAuth permissions page lists all active scopes with clear plain-language explanations.
- [ ] Gmail revoke calls Google's revocation endpoint AND clears tokens from DB.
- [ ] Revoking Gmail does NOT delete the email address or discovered accounts.
- [ ] Data export generates a ZIP with all categories within 5 minutes of request.
- [ ] Export download link is a signed URL, valid for 24 hours only.
- [ ] Purge scan logs deletes `email_scans` and `account_events` but leaves `accounts` intact.
- [ ] Account deletion CASCADE removes all user data from all tables.
- [ ] Account deletion confirmation requires exact phrase input.
- [ ] All actions log an entry to `audit_log` (user_id set to NULL on account deletion).
