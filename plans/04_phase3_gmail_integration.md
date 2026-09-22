# Phase 3 — Gmail Integration

---

> ## 🚨 STOP — READ THIS BEFORE YOU START PHASE 3
>
> **As soon as the "Connect Gmail" button is working — apply for Google App Verification. Do not wait.**
>
> | What | Why it matters |
> |---|---|
> | `gmail.readonly` is a **Restricted Scope** | Google manually reviews every app that uses it |
> | Without approval | Only YOU (the developer) can test Gmail connect. Zero real users can use it. |
> | Approval time | **2 to 8 weeks.** Google can reject and restart the clock. |
> | What you need to apply | ✅ Live Privacy Policy URL ✅ Demo video of Gmail OAuth flow ✅ Written scope justification |
>
> **📅 Action:** The day Phase 3 connect flow works end-to-end → record a demo video → publish Privacy Policy → submit verification.
> Do NOT save this for launch week.

---

> The core discovery engine relies on efficient, privacy-respecting Gmail integration.

---

## Objective

Connect to Google's Gmail API to query relevant transactional and account-related emails without storing sensitive content, respecting both user privacy and Google's API usage policies.

---

## 3.1 — Google Cloud Console Setup

Before OAuth can work, these steps must be completed in Google Cloud Console:

1. Create a Project: `mylogin-prod` (and `mylogin-dev` for development).
2. Enable APIs:
   - **Gmail API**
   - **Google People API** (for profile data during login)
3. Configure OAuth Consent Screen:
   - App Name: `My_Login`
   - Authorized domains: `mylogin.app`
   - **Privacy Policy URL**: Required — must explain exactly what Gmail data is read and why.
   - **User Type**: External (requires Google verification for production)
4. Create OAuth 2.0 Credentials (Web Application type).
5. Add Authorized Redirect URIs:
   - `http://localhost:3000/auth/google/callback` (dev)
   - `https://mylogin.app/auth/google/callback` (prod)

> **Important:** Google requires app verification for sensitive scopes (`gmail.readonly`). Budget 2–4 weeks for the verification process before production launch.

---

## 3.2 — Scopes Strategy (Least-Privilege Principle)

| OAuth Flow | Scopes Requested | When |
|---|---|---|
| **Login Only** | `openid email profile` | On first sign-in / Google login |
| **Gmail Connect** | `gmail.readonly` | Separately, when user explicitly connects Gmail |

> **Critical UX Decision:** Do NOT bundle Gmail access with the login flow. Users who sign in with Google should not be forced to grant Gmail read access just to use the app. The Gmail permission is a separate, deliberate step in the onboarding flow.

This separation:
- Reduces user anxiety at login
- Increases Gmail connection conversion rates
- Passes Google's App Verification review more smoothly

---

## 3.3 — Authorization Flow (Gmail Connect)

```
User clicks "Connect Gmail" on Email Manager page
                    │
                    ▼
GET /api/v1/emails/{email_id}/gmail/connect
                    │
                    ▼
Backend constructs Google OAuth URL with:
  - scope: gmail.readonly
  - access_type: offline       (to get refresh_token)
  - prompt: consent            (force consent screen to always get refresh_token)
  - state: CSRF token (random, session-bound)
                    │
                    ▼
Redirect → Google OAuth Consent Screen
                    │
                    ▼
User Reviews & Approves "Read Gmail Messages"
                    │
                    ▼
GET /api/v1/auth/google/gmail-callback?code=...&state=...
                    │
  ┌─────────────────┼─────────────────────┐
  │ Validate CSRF   │ Exchange auth code  │
  │ state token     │ → access_token      │
  │                 │ → refresh_token     │
  └─────────────────┘                     │
                    │                     │
                    ▼                     ▼
         Encrypt tokens with      Save to user_emails
         AES-256-GCM using        (access_token,
         APP_ENCRYPTION_KEY       refresh_token,
                                  token_expires_at,
                                  gmail_scopes[])
                    │
                    ▼
         Enqueue initial Gmail scan job → BullMQ (gmail queue)
                    │
                    ▼
         Redirect to frontend with status: "scanning"
```

---

## 3.4 — Data Minimization Principle

> **Firm Rule:** Only the minimum data required to identify a service and an event is extracted. Raw email bodies are **never persisted**.

### What Is Extracted and Stored Permanently:
| Field | Source Header | Purpose |
|---|---|---|
| `message_id` | `Message-ID` header | Deduplication — prevents re-processing the same email |
| `thread_id` | Gmail API `threadId` | Thread-level grouping |
| `sender_email` | `From` header | Domain-based service matching |
| `sender_name` | `From` header (display name) | Human-readable sender display |
| `recipient_email` | `To` / `Delivered-To` | Identifies which user email received it |
| `subject` | `Subject` header | Pattern matching for event classification |
| `timestamp` | `Date` / `internalDate` | Account first-seen and activity dates |
| `detected_service_id` | Derived (lookup result) | FK to `services` catalog |
| `event_type` | Derived (classification result) | SIGNUP / LOGIN_ALERT / TRANSACTION etc. |

### What Is NEVER Stored:
- Email body HTML or plain text
- Attachments
- Email thread content
- CC / BCC headers
- Email labels or categories (Gmail-side)

---

## 3.5 — Search Query Strategy

Instead of downloading the full inbox, targeted Gmail `q` queries are used. Each query runs as a separate paginated batch:

```typescript
const DISCOVERY_QUERIES: string[] = [
  // Account creation signals
  '"welcome to" OR "thanks for joining" OR "your new account"',
  '"confirm your email" OR "verify your email" OR "activate your account"',
  '"get started" OR "account created" OR "you\'re in"',

  // Security & authentication events
  '"password reset" OR "forgot your password" OR "change your password"',
  '"security alert" OR "new sign-in" OR "new device" OR "unusual activity"',
  '"two-factor" OR "2-step verification" OR "your verification code"',

  // Subscription & transaction events
  '"subscription confirmed" OR "your subscription" OR "your plan"',
  '"receipt for" OR "your order" OR "invoice" OR "payment received"',

  // Account management
  '"your account" OR "manage your account" OR "account settings"',
];
```

### Query Execution Rules:
- Run queries sequentially to respect quota limits.
- Use `maxResults=100` per page, paginate using `nextPageToken`.
- Each message returned only needs `metadata` format — **never** `full` or `raw`.
- Gmail API quota unit cost: `metadata` format = **5 units** per message vs. `raw` = **25 units**.

---

## 3.6 — Token Lifecycle & Refresh Handling

### Access Token Refresh
```typescript
// Pseudocode — executed before every Gmail API call
async function getValidAccessToken(userEmail: IUserEmail): Promise<string> {
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (!userEmail.gmailTokenExpiresAt || userEmail.gmailTokenExpiresAt < fiveMinFromNow) {
    // Token expired or expiring soon — refresh
    const refreshed = await googleOAuthClient.refreshToken(
      decrypt(userEmail.gmailRefreshToken!)
    );
    userEmail.gmailAccessToken = encrypt(refreshed.access_token);
    userEmail.gmailTokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await userEmail.save();
  }
  return decrypt(userEmail.gmailAccessToken!);
}
```

### Token Revocation (on Disconnect)
When a user disconnects Gmail:
1. Call `https://oauth2.googleapis.com/revoke?token={access_token}` (Google's revocation endpoint).
2. Delete `gmail_access_token` and `gmail_refresh_token` from database.
3. Mark `gmail_connected = false`.
4. Log the revocation event in `security_events`.

> If Google's revocation API call fails (network error), still delete the local tokens. The user's intent to disconnect must always be honored.

---

## 3.7 — Async Batch Processing Architecture

```
Express Request: POST /api/v1/emails/:id/scan
                    │
                    ▼ (Enqueue, return immediately)
            Redis Job Queue ("gmail")
                    │
                    ▼ (BullMQ Worker picks up job)
        Gmail Scanner Worker
                    │
  ┌─────────────────┼──────────────────────┐
  │ 1. Get valid    │ 2. Execute queries    │ 3. Batch
  │ access token    │ sequentially          │ message IDs
  │                 │                       │
  └─────────────────┴──────────────────────┘
                    │
                    ▼
        Gmail API: messages.list (metadata only)
                    │
                    ▼ (Per message batch — 100 at a time)
        Gmail API: messages.get (format: metadata)
                    │
                    ▼
        Discovery Engine Worker (Phase 4)
                    │
                    ▼
        Persist account_events to DB
                    │
                    ▼
        Update email_scan record: status=completed
                    │
                    ▼
        Trigger Breach Check for email (async)
                    │
                    ▼
        Send in-app notification: "Scan complete — X accounts found"
```

---

## 3.8 — Error Handling & Resilience

| Error Scenario | Handling |
|---|---|
| `401 Unauthorized` (token expired) | Refresh token, retry once. If refresh fails → mark scan as `auth_error`, notify user to re-connect Gmail. |
| `429 Too Many Requests` | Exponential backoff: 1s, 2s, 4s, 8s, 16s — then pause job and reschedule after 1 hour. |
| `403 Forbidden` (scope revoked by user from Google) | Mark Gmail as disconnected, notify user. |
| `5xx Server Error` | Retry up to 3 times with backoff. Mark scan as `failed` after 3 retries. |
| Worker crash mid-scan | Job is re-queued from last saved `nextPageToken` checkpoint. |

### Scan Checkpoint Strategy
- After every 500 messages processed, save current `nextPageToken` and `emails_processed` count to `email_scans` table.
- If worker dies, resume from last checkpoint — no full rescan needed.

---

## 3.9 — Privacy Notice Requirement

Before the Gmail OAuth consent screen appears, My_Login must display a clear **"What we access"** modal:

```
Before we connect your Gmail, here's what we do:

✅ We READ email headers (sender, subject, date) to identify services.
✅ We STORE only the service name and event date — nothing else.
❌ We NEVER read or store your email body text.
❌ We NEVER share your data with third parties.
❌ We NEVER sell your email data.

You can disconnect at any time from Settings → Privacy.
```

This is required both by Google's App Verification policy and is good ethical practice.

---

## Acceptance Criteria

- [ ] OAuth flow separately requests `gmail.readonly` — never bundled with login.
- [ ] CSRF `state` parameter is validated in the callback to prevent OAuth hijacking.
- [ ] Access/refresh tokens are stored AES-256-GCM encrypted at rest.
- [ ] Only `metadata` message format is fetched — never `full` or `raw`.
- [ ] No email body text is persisted in any database table.
- [ ] Token refresh is handled automatically before each API call.
- [ ] Token revocation calls Google's revocation endpoint on disconnect.
- [ ] Scan progress is checkpointed every 500 messages for crash resilience.
- [ ] All Gmail API error codes are handled with appropriate retry / user-notification logic.
- [ ] Pre-OAuth privacy disclosure modal is shown before consent screen redirect.
