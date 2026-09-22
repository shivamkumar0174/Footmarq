# Phase 6 — Account Dashboard

> The main command center: the first screen users see after scan completes. It must be clear, fast, and immediately useful.

---

## Objective

Deliver an intuitive, high-performance dashboard providing instant visibility into every discovered account — with risk indicators, category grouping, and one-click actions — all rendering in under 1.5 seconds.

---

## 6.1 — Full UI Layout Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  My_Login                          [🔔 3]  [📧 Emails]  [👤 Harshit]  [⚙️] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 📦 71        │  │ 🔴 3         │  │ 🟠 4         │  │ 💤 12        │   │
│  │ Total        │  │ Breaches     │  │ High Risk    │  │ Inactive     │   │
│  │ Accounts     │  │ Active       │  │ Accounts     │  │ Accounts     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
│  🔍 [ Search accounts...                                              ] 🎛️  │
│                                                                             │
│  ┌─── Categories ──────────────────────────────────────────────────────┐   │
│  │ [ All (71) ] [ Social (14) ] [ Shopping (18) ] [ Finance (6) ]      │   │
│  │ [ Dev (5) ]  [ Entertainment (9) ] [ Productivity (12) ] [ + More ] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Sort: [ Recently active ▼ ]   View: [ ⊞ Grid ] [ ≡ List ]   [Filter 🎛️]  │
│                                                                             │
│  ┌──────────────────────────────────────────┐                             │
│  │  🟢  Spotify                             │                             │
│  │  ──────────────────────────────────────  │                             │
│  │  Entertainment · user@gmail.com          │                             │
│  │  First detected: 14 Mar 2021             │                             │
│  │  Last activity:  2 days ago              │                             │
│  │  Risk: LOW ●                             │                             │
│  │                                          │                             │
│  │  [ 🌐 Open ] [ ⚙️ Settings ] [ 🔒 Security ] [ 🧹 Cleanup ]           │
│  └──────────────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6.2 — Metrics Header (Top Stats Bar)

The 4 metric cards are computed server-side and cached per-user in Redis (TTL: 5 min):

| Card | Value Source | Click Action |
|---|---|---|
| **Total Accounts** | `COUNT(*) FROM accounts WHERE user_email_id IN (...)` | Resets all filters |
| **Active Breaches** | `COUNT(*) WHERE is_breached = true` | Opens Security Center → Breaches tab |
| **High/Critical Risk** | `COUNT(*) WHERE risk_level IN ('high','critical')` | Filters dashboard to high/critical |
| **Inactive Accounts** | `COUNT(*) WHERE activity_status = 'inactive'` | Opens Cleanup page |

---

## 6.3 — Account Card Components

### Card Fields (Grid View)
```
┌────────────────────────────────────┐
│ [SERVICE LOGO 48x48]               │
│ Service Name            [RISK BADGE]│
│ Category tag                        │
│ 📧 user@gmail.com                   │
│ First seen: 14 Mar 2021             │
│ Active: 2 days ago                  │
├────────────────────────────────────┤
│ [Open] [Settings] [Security] [More]│
└────────────────────────────────────┘
```

### Risk Badge Color Coding
| Risk Level | Badge Color | Border |
|---|---|---|
| LOW | `#22c55e` (green) | Green left border |
| MODERATE | `#f59e0b` (amber) | Amber left border |
| HIGH | `#f97316` (orange) | Orange left border |
| CRITICAL | `#ef4444` (red) | Red left border + pulsing dot |
| BREACHED | `#dc2626` (dark red) | Red background tint |

### List View (Compact Row)
```
[LOGO] Spotify          Entertainment · user@gmail.com    Active 2d ago    🟢 LOW    [Open] [⚙]
[LOGO] OldForum         Social · user@outlook.com          Inactive 4yr     🔴 HIGH   [Open] [⚙]
```

---

## 6.4 — Account Detail Side Panel

Opens as a slide-in right panel (not a full modal) so users can browse accounts while viewing details:

```
┌──────────────────────────────────────────────────────┐
│  ← Back      ACCOUNT DETAIL               [X Close]  │
├──────────────────────────────────────────────────────┤
│  [Spotify Logo]  Spotify                             │
│  Entertainment   spotify.com                         │
│  via user@gmail.com                                  │
├──────────────────────────────────────────────────────┤
│  RISK SCORE           BREACH STATUS                  │
│  ████░░░░ 22/100      ✅ No breach detected           │
│  Moderate                                            │
│                                                      │
│  2FA Status: ● Supported but Unknown                 │
│  Account Age: 5 years 2 months                       │
│  Activity:   Active (last 2 days)                    │
├──────────────────────────────────────────────────────┤
│  ACTIVITY TIMELINE                                   │
│  ─────────────────────────────────                   │
│  🔵 SIGNUP           14 Mar 2021                     │
│  💳 TRANSACTION      Subscription renewed · Jan 2024 │
│  💳 TRANSACTION      Subscription renewed · Jan 2025 │
│  💳 TRANSACTION      Subscription renewed · Jan 2026 │
│  🔑 PASSWORD RESET   08 Jun 2023                     │
├──────────────────────────────────────────────────────┤
│  QUICK ACTIONS                                       │
│  [ 🌐 Open Spotify ]                                 │
│  [ ⚙️  Account Settings ]                           │
│  [ 🔒 Security & 2FA Settings ]                     │
│  [ 🗑️  Delete Account ]                              │
│  [ 📝 Add Note ]                                     │
├──────────────────────────────────────────────────────┤
│  RISK BREAKDOWN                                      │
│  ● Account age > 5 years           +10               │
│  ● 2FA status unknown              +15               │
│  ─────────────────────────────                       │
│  Total Risk Score: 25 (Moderate)                     │
└──────────────────────────────────────────────────────┘
```

---

## 6.5 — Sorting Options

| Sort Option | SQL Order |
|---|---|
| Recently Active (default) | `ORDER BY last_activity_at DESC` |
| Risk Score (highest first) | `ORDER BY risk_score DESC` |
| First Discovered | `ORDER BY first_detected_at ASC` |
| Name A–Z | `ORDER BY service_name ASC` |
| Breach Status | `ORDER BY is_breached DESC, risk_score DESC` |
| Inactivity (longest first) | `ORDER BY last_activity_at ASC` |

---

## 6.6 — API Endpoints

```
GET  /api/v1/accounts
     ?category=entertainment
     &risk_level=high,critical
     &email_id=uuid
     &status=inactive
     &search=spotify
     &sort=risk_score
     &page=1
     &page_size=20

GET  /api/v1/accounts/{account_id}          → full account detail
GET  /api/v1/accounts/summary               → metric header counts (cached)
POST /api/v1/accounts/{account_id}/note     → add/update user note
POST /api/v1/accounts/{account_id}/archive  → archive (soft-delete)
POST /api/v1/accounts/{account_id}/mark-deleted → mark as "I deleted this account"
```

---

## 6.7 — Frontend State Management

```typescript
// Zustand store shape
interface DashboardStore {
  accounts: Account[];
  totalCount: number;
  filters: {
    category: string | null;
    riskLevel: string[];
    emailId: string | null;
    activityStatus: string | null;
    isBreached: boolean | null;
    search: string;
  };
  sort: SortOption;
  view: 'grid' | 'list';
  page: number;
  selectedAccountId: string | null;  // null = no side panel
  setFilter: (key: string, value: any) => void;
  resetFilters: () => void;
  setSort: (sort: SortOption) => void;
  selectAccount: (id: string) => void;
}
```

---

## 6.8 — Performance Requirements

| Metric | Target |
|---|---|
| Initial dashboard load (first paint) | ≤ 1.5s |
| Filter/sort update (no API call, client-side) | ≤ 100ms |
| API response for paginated account list | ≤ 300ms |
| Metric header load (Redis cached) | ≤ 50ms |
| Side panel open animation | 200ms ease-in-out |
| Account card logo image load | Served from CDN, lazy-loaded |

---

## Acceptance Criteria

- [ ] Dashboard renders all 4 metric cards with accurate counts.
- [ ] Account cards display in both grid and list views with all required fields.
- [ ] Risk badge colors and pulsing animation render correctly for CRITICAL/BREACHED accounts.
- [ ] Account detail side panel slides in without full-page reload.
- [ ] Activity timeline in side panel displays all events in chronological order.
- [ ] Risk breakdown section explains each contributing factor with its point value.
- [ ] Sorting by all 6 sort options returns correctly ordered results.
- [ ] Pagination loads the next page without resetting filter state.
- [ ] Dashboard is responsive across mobile (≥ 320px), tablet, and desktop viewports.
- [ ] Empty state renders correctly when no accounts match the current filter.
