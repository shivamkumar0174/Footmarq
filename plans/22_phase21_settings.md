# Phase 21 — Settings

> The control panel for everything personalized — profile, security, sync, notifications, and appearance.

---

## Objective

Centralize all user-configurable preferences, profile management, active session controls, and sync scheduling into a clean, well-organized settings interface — backed by a proper settings schema that persists across devices.

---

## 21.1 — Settings Architecture Overview

```
Settings
│
├── 👤 Profile            → Name, picture, email, password change
├── 🔒 Security           → 2FA (TOTP), active sessions, login history
├── 📧 Emails & Sync      → Connected emails, scan frequency, manual scan
├── 🔔 Notifications      → Per-category, per-channel controls
├── 🎨 Appearance         → Theme, layout density, language, timezone
├── 🧾 Subscription       → Plan details, upgrade, billing history
└── 🔐 Privacy            → Link to Privacy Center (Phase 20)
```

---

## 21.2 — Profile Settings

```
PROFILE

  [Avatar: HT]  [ Change Photo ]

  Display Name        [ Harshit Tripathi          ] [Save]
  Primary Email       user@gmail.com               (verified ✅)
  Auth Method         Google OAuth                 (cannot change)

  ─────────────────────────────────────────────────

  CHANGE PASSWORD
  (Only available for email/password accounts — not Google OAuth users)

  Current Password    [ ••••••••••••             ]
  New Password        [ ••••••••••••             ]
  Confirm Password    [ ••••••••••••             ]
                                                 [Update Password]

  ─────────────────────────────────────────────────

  DANGER ZONE
  [ Delete My Account ]    ← Links to Privacy Center deletion flow
```

---

## 21.3 — Security Settings

### 2FA for My_Login Account

My_Login itself should be protected by 2FA — independent of what services users have connected.

```
MY_LOGIN ACCOUNT 2FA

  Status: ● Not enabled

  [ Enable 2-Factor Authentication ]

  ── On clicking Enable: ─────────────────────────────────
  1. Open authenticator app (Google Authenticator, Authy, 1Password, etc.)
  2. Scan QR code:  [████████████]
     Or enter key:  JBSWY3DPEHPK3PXP

  3. Enter 6-digit code to confirm:  [ _______ ] [Verify]
  ────────────────────────────────────────────────────────

  ── After enabling: ─────────────────────────────────────
  Status: ● Enabled (via Authenticator App)

  [ View Backup Codes ]    [ Disable 2FA ]
  ────────────────────────────────────────────────────────
```

**Backup codes**: 10 single-use codes generated at 2FA setup. Stored as bcrypt hashes in DB.

### Active Sessions
```
ACTIVE SESSIONS

  ● This device — Chrome / Linux · 192.168.1.1    Active now    [Revoke]
  ○ iPhone 15 · iOS · 10.0.0.42                  2 days ago    [Revoke]
  ○ Work MacBook · Safari / macOS                 5 days ago    [Revoke]

  [ Revoke All Other Sessions ]
```

### Login History (Last 30 Days)
```
LOGIN HISTORY

  ✅  12 Aug 2026  10:05  Chrome / Linux     192.168.1.1   Success
  ❌  11 Aug 2026  09:34  Unknown / Android  45.80.xx.xx   Failed (wrong password)
  ✅  10 Aug 2026  14:22  iPhone / iOS       10.0.0.42     Success
```

---

## 21.4 — Emails & Sync Settings

```
EMAILS & SYNC

  Connected Emails (3)

  ● user@gmail.com          ✅ Gmail connected
    Auto-scan: Weekly (Mondays)
    Last scan: 12 Aug 2026 08:00
    [ Change frequency ▼ ]  [ Scan Now ]  [ Disconnect ]

  ● user@company.com        ✅ Gmail connected
    Auto-scan: Manual only
    Last scan: 05 Aug 2026 11:30
    [ Change frequency ▼ ]  [ Scan Now ]  [ Disconnect ]

  ● old@hotmail.com         ⚠️ Not connected (Outlook — no Gmail)
    Breach check: Monthly
    [ Manage ]

  ────────────────────────────────────────────
  SCAN FREQUENCY OPTIONS (per email)
    ○ Daily     (Pro)
    ● Weekly    (default)
    ○ Monthly
    ○ Manual only

  GLOBAL SYNC
  [ Scan All Emails Now ]   Runs scan for all connected Gmail accounts
```

---

## 21.5 — Notification Settings

```
NOTIFICATIONS

  CHANNEL DEFAULTS
  ─────────────────────────────────────────
  📱 In-App         ● Always on
  📧 Email          ● Enabled
  🔔 Push           ○ Enable browser push  [ Request Permission ]

  ─────────────────────────────────────────
  NOTIFICATION CATEGORIES

  Category              In-App   Email   Push
  ──────────────────    ──────   ─────   ────
  Breach Detected        ✅       ✅      ✅
  Critical Risk Change   ✅       ✅      ✅
  Security Alerts        ✅       ✅      ○
  Scan Complete          ✅       ○       ○
  New Account Found      ✅       ○       ○
  Inactivity Warning     ✅       ✅      ○
  Cleanup Reminder       ✅       ✅      ○
  Weekly Digest          N/A      ✅      ○
  System / Auth          ✅       ✅      ○

  [ Save Preferences ]
```

---

## 21.6 — Appearance Settings

```
APPEARANCE

  THEME
  ◉ System default (follows OS setting)
  ○ Light mode
  ○ Dark mode

  DASHBOARD LAYOUT
  ◉ Comfortable (cards with more spacing)
  ○ Compact    (more accounts visible at once)

  LANGUAGE
  [ English (en) ▼ ]
  Available: English, Hindi, Spanish, French, German, Japanese

  TIMEZONE
  [ Asia/Kolkata (UTC+5:30) ▼ ]
  Used for: displaying event timestamps, scan scheduling

  DATE FORMAT
  ◉ DD MMM YYYY (12 Aug 2026)
  ○ MM/DD/YYYY  (08/12/2026)
  ○ YYYY-MM-DD  (2026-08-12)

  [ Save Appearance ]
```

---

## 21.7 — Subscription Settings

```
SUBSCRIPTION

  Current Plan: FREE

  [ Upgrade to Pro — $4.99/month ]

  Pro features you're missing:
  • Unlimited email connections (you're at 2/2)
  • Automated weekly breach monitoring
  • Digital Footprint graph
  • Account Cleanup assistant
  • AI Natural Language assistant

  ─────────────────────────────────────────
  (For Pro users:)

  Plan: PRO · $4.99/month
  Billing: Monthly · Next charge: Sep 12, 2026
  Payment: Visa ending in 4242

  [ Switch to Annual (save 18%) ]   [ Cancel Plan ]
  [ View Billing History ]
```

---

## 21.8 — Database Schema (User Settings)

```sql
CREATE TABLE user_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Appearance
  theme             VARCHAR(20) DEFAULT 'system',    -- system | light | dark
  language          VARCHAR(10) DEFAULT 'en',
  timezone          VARCHAR(50) DEFAULT 'UTC',
  date_format       VARCHAR(20) DEFAULT 'DD MMM YYYY',
  dashboard_layout  VARCHAR(20) DEFAULT 'comfortable', -- comfortable | compact

  -- 2FA
  two_fa_enabled    BOOLEAN DEFAULT false,
  two_fa_secret     TEXT,                             -- encrypted TOTP secret
  backup_codes      TEXT[],                           -- bcrypt-hashed backup codes

  -- Subscription
  plan              VARCHAR(20) DEFAULT 'free',       -- free | pro | family | teams
  plan_expires_at   TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

---

## 21.9 — API Endpoints

```
GET    /api/v1/settings                  → get all user settings
PATCH  /api/v1/settings/profile          → update name, timezone, language
PATCH  /api/v1/settings/appearance       → update theme, layout, date format
PATCH  /api/v1/settings/notifications    → update per-category notification prefs

POST   /api/v1/settings/2fa/setup        → generate TOTP secret + QR code
POST   /api/v1/settings/2fa/verify       → confirm 6-digit code, activate 2FA
DELETE /api/v1/settings/2fa              → disable 2FA (requires current 2FA code)
GET    /api/v1/settings/2fa/backup-codes → view backup codes (requires 2FA auth)

GET    /api/v1/settings/sessions         → list active sessions
DELETE /api/v1/settings/sessions/{id}    → revoke specific session
DELETE /api/v1/settings/sessions         → revoke all other sessions

GET    /api/v1/settings/login-history    → last 30 days of login events
```

---

## Acceptance Criteria

- [ ] Profile update (name, avatar, timezone) saves and reflects immediately.
- [ ] Password change requires current password verification and invalidates all other sessions.
- [ ] Google OAuth users see a grayed-out "Change Password" section with explanation.
- [ ] 2FA TOTP setup generates a valid QR code scannable by standard authenticator apps.
- [ ] 2FA backup codes are generated as 10 single-use codes, stored as bcrypt hashes.
- [ ] Active session revocation immediately invalidates the corresponding refresh token.
- [ ] Login history shows last 30 days with correct success/failure status.
- [ ] Notification preferences save per-category and per-channel correctly.
- [ ] Push permission request only fires when user explicitly enables push in settings.
- [ ] Theme change applies instantly (CSS variables swap — no page reload).
- [ ] Timezone setting is respected in all timestamp displays across the app.
- [ ] Subscription page correctly shows plan details and upgrade prompt for free users.
