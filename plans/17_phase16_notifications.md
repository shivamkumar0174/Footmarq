# Phase 16 — Notifications

> Timely, relevant, and non-spammy alerts that keep users informed without burning their attention.

---

## Objective

Build a multi-channel notification system with granular user controls, supporting In-App, Email, and Web Push delivery — with immediate alerts for critical security events and batched digests for lower-priority updates.

---

## 16.1 — Notification Categories & Priority

| Category                   | Priority    | Default On | Example Messages                                               |
| -------------------------- | ----------- | ---------- | -------------------------------------------------------------- |
| **Breach Detected**        | 🔴 Critical | ✅ Yes     | "Your email was found in a new data breach — Dropbox 2016"     |
| **Critical Risk Change**   | 🔴 Critical | ✅ Yes     | "Your GitHub account risk level changed to CRITICAL"           |
| **Security Alert**         | 🟠 High     | ✅ Yes     | "New login detected on your Amazon account"                    |
| **Scan Complete**          | 🟡 Medium   | ✅ Yes     | "Scan complete — 5 new accounts discovered for user@gmail.com" |
| **New Account Discovered** | 🟡 Medium   | ✅ Yes     | "We found a new account: Notion via user@company.com"          |
| **Inactivity Warning**     | 🟡 Medium   | ✅ Yes     | "12 accounts haven't been used in 6+ months"                   |
| **Cleanup Reminder**       | 🟢 Low      | ✅ Yes     | "3 accounts in your cleanup queue are waiting for action"      |
| **Weekly Digest**          | 🟢 Low      | ✅ Yes     | "Your weekly security summary: 82 score, 1 new breach"         |
| **System / Auth**          | ℹ️ Info     | ✅ Yes     | "Gmail sync token expired. Please reconnect."                  |
| **Marketing / Tips**       | ℹ️ Info     | ❌ No      | "Tip: enable 2FA on finance accounts to improve your score"    |

---

## 16.2 — Delivery Architecture

```
Event Occurs (breach detected, scan complete, etc.)
                  │
                  ▼
     NotificationService.create_notification(
       user_id, category, title, body, metadata
     )
                  │
                  ▼
     ┌────────────────────────────────────────┐
     │  Check user's notification preferences │
     │  (per channel, per category)           │
     └────────────┬───────────────────────────┘
                  │
                   │
      ┌────────────┴─────────────┐
      ▼                          ▼
   Always                     If enabled
   ─────────                  ──────────
   In-App DB                  Email Queue
   (instant)                  (BullMQ maintenance)
      │                          │
      ▼                          ▼
   MongoDB                    Resend API
   (reads via API)            (email dispatch)
```

---

## 16.3 — Database Schema

## 16.3 — Database Schema (Mongoose)

```typescript
// models/notification.schema.ts
const NotificationSchema = new Schema({
  userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountId:       { type: Schema.Types.ObjectId, ref: 'Account' },
  category:        { type: String, required: true },
  priority:        { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'], default: 'medium' },
  title:           { type: String, required: true },
  body:            { type: String },
  actionUrl:       { type: String },
  actionLabel:     { type: String },
  icon:            { type: String },
  isRead:          { type: Boolean, default: false },
  isDismissed:     { type: Boolean, default: false },
  deliveredEmail:  { type: Boolean, default: false },
  readAt:          { type: Date },
}, { timestamps: true });

NotificationSchema.index({ userId: 1, isRead: 1, isDismissed: 1 });

const NotificationPrefSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category:  { type: String, required: true },
  inApp:     { type: Boolean, default: true },
  email:     { type: Boolean, default: true },
}, { timestamps: true });

NotificationPrefSchema.index({ userId: 1, category: 1 }, { unique: true });
```

---

## 16.4 — In-App Notification Center

The notification bell icon in the top nav bar:

```
🔔 3          ← unread count badge

On click:
┌─────────────────────────────────────────────────────┐
│  NOTIFICATIONS                  [ Mark all read ]   │
├─────────────────────────────────────────────────────┤
│  🔴 NEW BREACH — Dropbox                            │
│  Your Gmail email was exposed. Act now.    2m ago   │
│  [ View Details ]                                   │
├─────────────────────────────────────────────────────┤
│  🟡 SCAN COMPLETE — user@gmail.com                  │
│  5 new accounts discovered.               15m ago   │
│  [ View Accounts ]                                  │
├─────────────────────────────────────────────────────┤
│  💤 INACTIVITY ALERT                                │
│  12 accounts unused for 6+ months.         2h ago   │
│  [ Review Cleanup ]                                 │
├─────────────────────────────────────────────────────┤
│  [ Load older notifications ]                       │
└─────────────────────────────────────────────────────┘
```

---

## 16.5 — Email Notifications

### Immediate (Critical/High Priority)

Sent immediately via Resend API (or via BullMQ maintenance queue):

**Breach Alert Email:**

```
Subject: 🔴 Security Alert — Your email was found in a data breach

Hello Harshit,

Your email address (user@gmail.com) was found in a newly
reported data breach:

  Service: Dropbox
  Breach Date: August 31, 2016
  Data Exposed: Email addresses, Passwords

RECOMMENDED ACTIONS:
  1. Change your Dropbox password immediately
  2. Enable two-factor authentication on Dropbox
  3. Check for password reuse on other services

[ 🔒 View Security Center ]

My_Login never stores your passwords.
Unsubscribe from breach alerts | Privacy Policy
```

### Weekly Digest (Every Monday)

Batched summary of the week's activity:

```
Subject: 📊 Your Weekly Security Summary — Aug 12, 2026

Security Score: 82 / 100 (GOOD) ↑ from 78 last week

This week:
  ✅ 0 new breaches detected
  📦 3 new accounts discovered
  💤 12 accounts still inactive

Top action this week:
  Enable 2FA on PayPal to improve your score by 5 points.

[ View Full Report ]
```

---

## 16.6 — Web Push Notifications

Uses the **Web Push API** (VAPID keys) for browser push and **Firebase Cloud Messaging** for mobile:

```javascript
// Request push permission (only shown once, on user's first security alert)
async function requestPushPermission() {
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    const subscription = await serviceWorker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    });
    await api.post("/api/v1/notifications/push-subscription", { subscription });
  }
}
```

Push payload:

```json
{
  "title": "🔴 New Data Breach Detected",
  "body": "Your email was found in a Dropbox breach. Tap to view details.",
  "icon": "/icons/breach-alert.png",
  "badge": "/icons/badge.png",
  "data": { "action_url": "/security?tab=breaches" }
}
```

---

## 16.7 — Notification Delivery Rules

| Scenario                   | In-App     | Email                | Push          |
| -------------------------- | ---------- | -------------------- | ------------- |
| New breach (critical)      | ✅ Instant | ✅ Instant           | ✅ Instant    |
| Risk score critical change | ✅ Instant | ✅ Instant           | ✅ If enabled |
| Scan complete              | ✅ Instant | ❌ Batched in digest | ❌ No         |
| Inactivity warning         | ✅ Weekly  | ✅ Weekly digest     | ❌ No         |
| Gmail token expired        | ✅ Instant | ✅ Instant           | ❌ No         |
| New account discovered     | ✅ Batched | ❌ Digest only       | ❌ No         |
| Cleanup reminder           | ✅ Weekly  | ✅ Weekly digest     | ❌ No         |

---

## Acceptance Criteria

- [ ] All 9 notification categories are implemented with correct priority levels.
- [ ] In-App notification center renders with unread count badge, read/unread state, and "Mark all read".
- [ ] Email breach alerts are sent within 5 minutes of breach detection.
- [ ] Weekly digest email is generated every Monday and sent to all users with email notifications enabled.
- [ ] Web Push subscription is requested only once (after first critical event), not on app load.
- [ ] All 3 delivery channels respect per-category user preferences from `notification_preferences`.
- [ ] `delivered_email` and `delivered_push` flags are set only on successful delivery.
- [ ] Failed email deliveries are retried up to 3 times with exponential backoff.
- [ ] Notifications are never sent to users who have disabled that category and channel.
