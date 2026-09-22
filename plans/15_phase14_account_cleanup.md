# Phase 14 — Account Cleanup

> Shrinking the digital footprint — guided, transparent, and never automated without user intent.

---

## Objective

Identify stale accounts (inactive > 180 days) and guide users through official service deletion flows — reducing exposure without storing credentials or automating deletions.

---

## 14.1 — Cleanup Trigger Sources

Accounts are surfaced for cleanup from three entry points:

1. **Security Center** → "Inactive Accounts" tab → "Go to Cleanup"
2. **Account Dashboard** → Clicking the 💤 Inactive stat card
3. **Notification** → "12 accounts haven't been used in 6 months. Review now."

---

## 14.2 — Account Cleanup Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧹 DIGITAL CLEANUP                                                 │
│                                                                     │
│  12 accounts haven't had activity in over 180 days.                 │
│  Removing unused accounts reduces your exposure to future breaches. │
├──────────── Sort: [ Longest inactive ▼ ]  Filter: [ All ▼ ] ───────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  [Logo]  OldForum                    Inactive: 4 yr 2 mo    │    │
│  │  Social · via old@hotmail.com        Risk: 🟠 HIGH           │    │
│  │  First seen: Mar 2020                                        │    │
│  │                                                              │    │
│  │  [ ⚙️ Settings ]  [ 🗑️ Delete Account ]  [ ✅ Keep ]  [⏰ 30d] │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  [Logo]  ExampleShop                 Inactive: 1 yr 8 mo    │    │
│  │  Shopping · via user@gmail.com       Risk: 🟡 MODERATE       │    │
│  │  First seen: Nov 2022                                        │    │
│  │                                                              │    │
│  │  [ ⚙️ Settings ]  [ 🗑️ Delete Account ]  [ ✅ Keep ]  [⏰ 30d] │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [ Dismiss all ]                         Showing 12 of 12 accounts │
└─────────────────────────────────────────────────────────────────────┘
```

### Action Buttons
| Button | Action |
|---|---|
| **⚙️ Settings** | Opens the service's account settings URL in a new tab |
| **🗑️ Delete Account** | Opens guided deletion flow (see 14.3) |
| **✅ Keep** | Marks account as "user confirmed active" — removes from cleanup queue for 90 days |
| **⏰ 30d** | Snooze — re-appears in cleanup queue after 30 days |

---

## 14.3 — Guided Deletion Flow

> **Non-Negotiable Privacy Guardrail:** My_Login never stores credentials, never automates deletions via headless browsers (violates TOS and exposes users to attack), and never "acts on behalf of" a user without their active, conscious participation in each step.

### Step-by-Step Guided Flow
When user clicks "Delete Account" for a service:

```
┌─────────────────────────────────────────────────────────┐
│  🗑️  DELETE ACCOUNT GUIDE — Spotify                      │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  We'll guide you through the official Spotify process.  │
│  My_Login will never delete accounts on your behalf.    │
│                                                         │
│  BEFORE YOU DELETE, CONSIDER:                           │
│  • Download your Spotify data first (GDPR export)       │
│  • Your playlists and liked songs will be lost          │
│  • Spotify Premium: Cancel subscription first           │
│                                                         │
│  STEPS:                                                 │
│  ○ 1. [ Open Spotify Account Page → ]                   │
│       Opens: support.spotify.com/article/close-account  │
│                                                         │
│  ○ 2. Log in to Spotify and navigate to deletion        │
│                                                         │
│  ○ 3. Confirm account deletion on the Spotify website   │
│                                                         │
│  ○ 4. [ I've deleted my Spotify account ]  ← confirm   │
│                                                         │
│  [Cancel — Keep Account]                                │
└─────────────────────────────────────────────────────────┘
```

### When `delete_account_url` Is NULL
For services without a cataloged deletion URL:
```
No direct deletion link available for this service.

[ 🔍 Search "How to delete {service} account" → ]
[ Open {service} main website → ]
[ View {service} Help Center → ]
```

---

## 14.4 — Post-Deletion Account State

When the user confirms "I've deleted this account":

```typescript
export async function markAccountDeleted(accountId: string, userId: string): Promise<void> {
  const account = await Account.findOne({ _id: accountId, userId });
  if (!account) throw new AppError('ACCOUNT_NOT_FOUND', 404);

  account.isDeletedByUser = true;
  account.isArchived = true;
  account.riskScore = 0;          // Deleted accounts carry zero risk
  account.activityStatus = 'deleted';
  await account.save();

  await SecurityEvent.create({
    accountId,
    userId,
    eventType: 'ACCOUNT_DELETED',
    title: 'Account deleted by user',
    severity: 'info',
  });

  await recalculateSecurityScore(userId);
}
```

Deleted accounts are:
- **Removed from active dashboard** (not visible in normal view)
- **Accessible via** "Show archived/deleted" toggle
- **Not counted** in security score or metrics
- **Retainable for audit**: user can see a history of accounts they've deleted

---

## 14.5 — Cleanup Priority Scoring

To sort cleanup recommendations by urgency, accounts are ranked by a composite cleanup priority score:

```
Cleanup Priority = (inactivity_days × 0.5) + (risk_score × 2) + (breach_bonus × 50)

Where:
  breach_bonus = 1 if is_breached else 0
```

This ensures breached inactive accounts always appear at the top, followed by high-risk inactive accounts, and then merely dormant low-risk accounts at the bottom.

---

## 14.6 — Bulk Cleanup Actions (Pro Feature)

Pro users can select multiple accounts and action them together:

```
[ ] Select all inactive > 1 year (8 accounts)
─────────────────────────────────────────────
☑ OldForum
☑ ExampleShop
☑ TestSite2019
...

[ Dismiss Selected (8) ]    [ Open All Settings (8) ]
```

Opening multiple settings pages simultaneously is confirmed with a warning:
> "This will open 8 browser tabs. Continue?"

---

## 14.7 — GDPR Data Export Reminder

For services that support data export (from catalog `data_export_url`), My_Login shows a reminder step before deletion:

```
💡 Before deleting your account, you may want to download
   your data from {service}. Your photos, posts, and history
   will be permanently deleted.

   [ Download your data → ]  (Opens service's GDPR export page)
```

---

## Acceptance Criteria

- [ ] Cleanup dashboard shows all accounts with activity_status = 'inactive' (> 180 days).
- [ ] Accounts sorted by cleanup priority score (breached + high-risk first).
- [ ] "Delete Account" opens guided deletion flow with service-specific steps.
- [ ] For services with `delete_account_url` null, a search fallback is offered.
- [ ] GDPR data export reminder is shown for services with `data_export_url` in catalog.
- [ ] "Mark as Deleted" sets `is_deleted_by_user = true`, archives account, zeroes risk score.
- [ ] "Keep" dismisses account from cleanup queue for 90 days.
- [ ] "Snooze 30 days" re-adds to cleanup queue after 30 days.
- [ ] Deleted accounts are excluded from dashboard count and security score calculation.
- [ ] Deleted account history is viewable via "Show archived" toggle.
