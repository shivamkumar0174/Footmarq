# Phase 12 — 2FA & Security Signals

> Detecting multi-factor authentication status and security alert events from email records — honestly, without false claims.

---

## Objective

Track 2FA capability and usage signals per account using service catalog data and detected security emails — displaying honest, non-misleading status labels that never assert "disabled" without evidence.

---

## 12.1 — The Honest 2FA Status Model

> **Core Principle:** My_Login has read-only access to email. It cannot query a service's API to definitively know whether 2FA is on or off. Claiming otherwise would be misleading and damage user trust.

### Status Values

| Status | Code | Description | Display |
|---|---|---|---|
| **Enabled** | `enabled` | A 2FA event email was detected (OTP code, authenticator setup, hardware key confirmation) | 🟢 2FA Enabled |
| **Disabled** | `disabled` | A "2FA removed" or "2FA turned off" email was detected | 🔴 2FA Disabled |
| **Supported — Status Unknown** | `unknown` | Service supports 2FA (from catalog) but no 2FA email detected | 🟡 Status Unknown |
| **Unsupported** | `unsupported` | Service catalog confirms 2FA is not offered | ⚪ 2FA Not Available |
| **Catalog Unknown** | `catalog_unknown` | Service not in catalog; 2FA capability unconfirmed | ❓ Unknown |

### Status Resolution Logic

```typescript
// discovery/discovery.2fa.ts
export function resolve2FAStatus(
  account: IAccount,
  events: IAccountEvent[]
): string {
  // Check for explicit 2FA signal emails first (most recent first)
  const sorted = [...events].sort(
    (a, b) => b.eventTimestamp.getTime() - a.eventTimestamp.getTime()
  );

  for (const event of sorted) {
    if (event.subject && matches2FAEnabled(event.subject)) return 'enabled';
    if (event.subject && matches2FADisabled(event.subject)) return 'disabled';
  }

  // No 2FA email signal found — fall back to catalog
  const service = account.serviceId as IService | null;
  if (!service) return 'catalog_unknown';
  if (!service.supports2FA) return 'unsupported';

  return 'unknown';  // Supports 2FA but no status email detected
}
```

---

## 12.2 — 2FA Signal Detection Patterns

```typescript
// discovery/discovery.patterns.ts
const TWO_FA_ENABLED_PATTERNS: RegExp[] = [
  /two.factor authentication (?:enabled|activated|set up)/i,
  /authenticator app (?:added|linked|configured)/i,
  /security key (?:added|registered)/i,
  /your (?:2fa|2-step|two-factor) (?:verification|authentication) (?:code|otp)/i,
  /passkey (?:added|registered|set up)/i,
  /your recovery codes/i,
  /backup codes for/i,
];

const TWO_FA_DISABLED_PATTERNS: RegExp[] = [
  /two.factor authentication (?:disabled|removed|turned off)/i,
  /two.factor authentication has been removed/i,
  /authenticator app (?:removed|unlinked)/i,
  /security key removed/i,
];

export const matches2FAEnabled = (subject: string) =>
  TWO_FA_ENABLED_PATTERNS.some(p => p.test(subject));

export const matches2FADisabled = (subject: string) =>
  TWO_FA_DISABLED_PATTERNS.some(p => p.test(subject));
```

---

## 12.3 — Security Event Parser (Full Signal Set)

Beyond 2FA, the security event parser extracts these signal categories from email subjects:

| Signal Type | Pattern Examples | Event Type Stored |
|---|---|---|
| **New Device Login** | "New sign-in from Chrome on Linux", "We noticed a new login" | `LOGIN_ALERT` |
| **Suspicious Activity** | "Suspicious activity detected", "Unusual sign-in attempt" | `SECURITY_ALERT` |
| **Password Changed** | "Your password has been changed", "Password successfully updated" | `PASSWORD_RESET` |
| **Account Locked** | "Your account has been locked", "Too many failed attempts" | `SECURITY_ALERT` |
| **2FA OTP Sent** | "Your [Service] verification code is", "Use this code to sign in" | `LOGIN_ALERT` + `two_factor_status = enabled` |
| **Data Request** | "Your data export is ready", "Download your data" | `ACCOUNT_UPDATE` |
| **Privacy Settings Changed** | "Your privacy settings were updated" | `ACCOUNT_UPDATE` |
| **Account Recovery Used** | "Your account was recovered using backup codes" | `SECURITY_ALERT` |

---

## 12.4 — 2FA Status in UI

### Account Card Badge
```
[Spotify Logo]  Spotify                    🟢 LOW RISK
Entertainment   user@gmail.com
2FA: 🟢 Enabled        Last active: 2 days ago
```

### Security Center — 2FA Tab
```
2FA STATUS OVERVIEW
───────────────────────────────────────────────────
🟢 Enabled          31 accounts
🔴 Disabled          2 accounts    [Fix →]
🟡 Status Unknown   15 accounts    [Review →]
⚪ Not Available    12 accounts
❓ Catalog Unknown  11 accounts
```

For "Status Unknown" accounts, My_Login surfaces a direct link to the service's 2FA settings page:
```
GitHub · Status Unknown
─────────────────────────
GitHub supports 2FA but we haven't detected a setup email.
We recommend enabling it.
[ Enable 2FA on GitHub → ]
```

---

## 12.5 — Database Schema

```sql
-- Already in accounts table:
-- two_factor_status VARCHAR(30) DEFAULT 'catalog_unknown'

-- Security events log (shared with breach monitoring):
-- security_events table (see Phase 10)

-- 2FA status history (for audit trail)
CREATE TABLE two_factor_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID REFERENCES accounts(id) ON DELETE CASCADE,
  status       VARCHAR(30) NOT NULL,       -- enabled | disabled | unknown
  detected_via VARCHAR(50),               -- email_pattern | manual | catalog
  email_subject TEXT,
  event_date   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

---

## Acceptance Criteria

- [ ] All 5 2FA status values are correctly implemented and displayed with distinct UI treatments.
- [ ] `enabled` status is only set when a specific 2FA setup or OTP email is detected.
- [ ] `disabled` status is only set when a 2FA removal email is detected.
- [ ] `unknown` status (not disabled) is the correct default for services that support 2FA but no email was detected.
- [ ] 2FA signal detection patterns are evaluated against all account_events on every scan.
- [ ] Security Center 2FA tab groups accounts correctly by status.
- [ ] Direct link to 2FA settings page is shown for "Status Unknown" accounts where `security_settings_url` exists in catalog.
- [ ] `two_factor_events` records the history of status changes with the triggering email subject.
