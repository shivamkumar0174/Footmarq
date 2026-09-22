# Phase 13 — Account Activity

> Understanding what a user has done on each service — and flagging what they've forgotten.

---

## Objective

Build a chronological activity timeline per account using email event history, calculate accurate inactivity status, and surface "forgotten account" alerts for accounts with no detected activity in 180+ days.

---

## 13.1 — Activity Event Taxonomy (Complete)

Every email event associated with an account is classified into one of these types. The classification happens during discovery (Phase 4) and is stored in `account_events.event_type`:

| Event Type | Code | Description | Counts as Activity |
|---|---|---|---|
| Account Created | `SIGNUP` | Welcome / registration / "Get started" email | ✅ Yes (initial) |
| Email Verification | `EMAIL_VERIFY` | "Verify your email address" | ✅ Yes |
| Login Alert | `LOGIN_ALERT` | "New sign-in from…" | ✅ Yes |
| Password Reset | `PASSWORD_RESET` | "Reset your password" request | ✅ Yes |
| Security Alert | `SECURITY_ALERT` | "Suspicious login detected" | ✅ Yes |
| Purchase / Receipt | `TRANSACTION` | Invoice, receipt, payment | ✅ Yes |
| Subscription | `SUBSCRIPTION` | "Your subscription is active/renewed" | ✅ Yes |
| Account Update | `ACCOUNT_UPDATE` | Profile change, email update | ✅ Yes |
| 2FA Event | `TWO_FACTOR` | 2FA setup, OTP email | ✅ Yes |
| Newsletter | `NEWSLETTER` | Marketing / weekly digest | ❌ No (excluded) |
| Promotional | `PROMOTIONAL` | Sale, offer, coupon | ❌ No (excluded) |
| General Notification | `GENERAL` | Product updates, announcements | ❌ No (ambiguous) |

> **Rule:** `last_activity_at` is updated only by event types marked **Yes** above. Newsletters and promotional emails do not indicate the user is actively using the account.

---

## 13.2 — Last Activity Date Calculation

```python
def calculate_last_activity(account_id: str) -> datetime:
    """
    Returns the timestamp of the most recent qualifying activity event.
    EXCLUDES newsletters, promotional emails, and general notifications.
    """
    ACTIVITY_EVENT_TYPES = {
        'SIGNUP', 'EMAIL_VERIFY', 'LOGIN_ALERT', 'PASSWORD_RESET',
        'SECURITY_ALERT', 'TRANSACTION', 'SUBSCRIPTION', 'ACCOUNT_UPDATE', 'TWO_FACTOR'
    }

    most_recent = db.query(AccountEvent).filter(
        AccountEvent.account_id == account_id,
        AccountEvent.event_type.in_(ACTIVITY_EVENT_TYPES)
    ).order_by(AccountEvent.event_timestamp.desc()).first()

    return most_recent.event_timestamp if most_recent else account.first_detected_at
```

---

## 13.3 — Inactivity Classification Thresholds

| Status | Condition | Badge | Interpretation |
|---|---|---|---|
| **Active** | Last activity ≤ 90 days | 🟢 | Regularly used |
| **Dormant** | Last activity 91–180 days | 🟡 | Occasional use or fading |
| **Inactive** | Last activity > 180 days | 🟠 | Likely forgotten |
| **Very Inactive** | Last activity > 365 days | 🔴 | Almost certainly forgotten |
| **Unknown** | No qualifying events at all | ⚪ | Only signup email or no events |

---

## 13.4 — Activity Timeline UI (Per Account)

Displayed in the Account Detail side panel:

```
ACTIVITY TIMELINE          [14 Mar 2021 → Present]
────────────────────────────────────────────────────
🔵  SIGNUP         14 Mar 2021    "Welcome to Spotify!"
🔑  PASSWORD RESET  08 Jun 2023    "Reset your Spotify password"
💳  SUBSCRIPTION   14 Mar 2024    "Your Spotify subscription renewed"
💳  SUBSCRIPTION   14 Mar 2025    "Your Spotify subscription renewed"
💳  SUBSCRIPTION   14 Mar 2026    "Your Spotify subscription renewed"
📱  LOGIN ALERT     04 Aug 2026    "New sign-in from iPhone"
────────────────────────────────────────────────────
Last Activity: 04 Aug 2026 (8 days ago) · 6 events total
Status: 🟢 ACTIVE
```

Controls:
- **Filter events**: Dropdown to show "All" / "Security only" / "Transactions only"
- **Timeline range**: Show "All time" or "Last 12 months"

---

## 13.5 — Inactivity Summary View

A dedicated "Inactive Accounts" view (accessible from Security Center and Cleanup):

```
INACTIVE ACCOUNTS                               12 accounts
────────────────────────────────────────────────────────────
Filter: [ > 180 days ] [ > 1 year ] [ > 2 years ] [ All ]

🔴 OldForum (Social)             Inactive 4 years 2 months
   via old@hotmail.com           First seen: Mar 2020
   [ Open ] [ Delete Account ] [ Keep / Dismiss ]

🟠 ExampleShop (Shopping)        Inactive 1 year 8 months
   via user@gmail.com            First seen: Nov 2022
   [ Open ] [ Delete Account ] [ Keep / Dismiss ]
```

---

## 13.6 — Activity Score Contribution

Account activity status feeds directly into the risk score (Phase 11):

| Activity Status | Risk Contribution |
|---|---|
| Active | 0 points |
| Dormant | 0 points (warning only) |
| Inactive | +15 points to risk score |
| Very Inactive on sensitive category | +15 + category sensitivity bonus |

---

## 13.7 — API Endpoints

```
GET /api/v1/accounts/{account_id}/activity
    ?event_types=SIGNUP,TRANSACTION,LOGIN_ALERT   (optional filter)
    &limit=50
    → paginated list of account_events

GET /api/v1/accounts/inactive
    ?min_days=180
    &category=finance
    → accounts grouped by inactivity duration

GET /api/v1/accounts/{account_id}/activity/summary
    → { last_activity_at, days_since_activity, status, event_count, first_seen }
```

---

## Acceptance Criteria

- [ ] `last_activity_at` is calculated excluding NEWSLETTER and PROMOTIONAL event types.
- [ ] Activity status (Active / Dormant / Inactive / Very Inactive) is updated on every scan completion.
- [ ] Account detail timeline renders events in reverse-chronological order with correct icons per event type.
- [ ] Timeline filter (All / Security / Transactions) works without a full page reload.
- [ ] Inactive accounts view groups by time range (> 180d / > 1yr / > 2yr) with correct counts.
- [ ] Inactivity feeds into risk score calculation with correct point contribution.
- [ ] Accounts with only SIGNUP email and no subsequent events are classified as "Unknown" not "Active".
- [ ] UI copy uses "No qualifying activity detected for N days" — never "You haven't used this account."

---

## What Is Intentionally NOT Implemented

```
❌ Real-time activity detection (email scan is the only signal)
❌ Cross-service login tracking
❌ Browser or app usage signals (no SDK integration)
❌ Activity signals from any source other than Gmail metadata
❌ Claiming "account is unused" — only "no qualifying activity detected"
❌ Activity import from password managers or browser history
```

---

## Cost / Complexity Considerations

- Activity tracking adds zero new DB tables — all data is already in `account_events`.
- Inactivity status is recomputed as a property of the account, not stored separately (except `activity_status` field which is updated on scan).
- The `last_activity_source` field (added to `accounts`) costs one column and saves one join for UI display.
- Language precision ("no qualifying activity detected") is free to implement and critical for user trust.
