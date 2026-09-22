# Phase 9 — Security Center

> A holistic security dashboard giving users a clear, honest, and actionable picture of their identity's risk state.

---

## Objective

Consolidate all security signals — breach status, risk scores, 2FA gaps, and inactive sensitive accounts — into a single, priority-sorted action center with an overall security score.

---

## 9.1 — Security Score Algorithm

The Security Score (0–100) reflects the user's current digital identity hygiene. It is recalculated whenever:
- A new breach is detected
- A Gmail scan completes
- An account is manually marked resolved/deleted
- Risk scores are recalculated

```typescript
// security/security.score.ts
export async function calculateSecurityScore(userId: string): Promise<number> {
  let score = 100;
  const accounts = await Account.find({ userId, isDeletedByUser: false, isArchived: false })
    .populate('serviceId').lean();

  // Breach penalties
  const breachedCount = accounts.filter(a => a.isBreached).length;
  score -= Math.min(breachedCount * 15, 45);        // Max -45 for breaches

  // High/Critical risk accounts (non-breached)
  const highRisk = accounts.filter(a =>
    ['high', 'critical'].includes(a.riskLevel) && !a.isBreached
  ).length;
  score -= Math.min(highRisk * 5, 15);              // Max -15 for high risk

  // Sensitive accounts with unknown 2FA — NOT 'unsupported' (user did nothing wrong)
  const sensitiveNo2FA = accounts.filter(a => {
    const svc = a.serviceId as IService | null;
    return svc && ['Finance', 'Developer'].includes(svc.category)
      && a.twoFactorStatus === 'unknown';            // ← only 'unknown'
  }).length;
  score -= Math.min(sensitiveNo2FA * 5, 15);        // Max -15

  // Inactive sensitive accounts
  const inactiveSensitive = accounts.filter(a => {
    const svc = a.serviceId as IService | null;
    return a.activityStatus === 'inactive'
      && svc && ['Finance', 'Developer', 'Healthcare'].includes(svc.category);
  }).length;
  score -= Math.min(inactiveSensitive * 3, 10);     // Max -10

  return Math.max(score, 0);                        // Never negative
}

### Score Tiers
| Range | Label | Color | Status Icon |
|---|---|---|---|
| 85–100 | **EXCELLENT** | `#22c55e` green | ✅ |
| 70–84 | **GOOD** | `#84cc16` lime | 🟢 |
| 50–69 | **MODERATE** | `#f59e0b` amber | 🟡 |
| 30–49 | **AT RISK** | `#f97316` orange | 🟠 |
| 0–29 | **CRITICAL** | `#ef4444` red | 🔴 |

---

## 9.2 — Security Center Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                       SECURITY CENTER                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│              ┌───────────────────────────┐                       │
│              │    SECURITY SCORE         │                       │
│              │                           │                       │
│              │         ████░░  82        │                       │
│              │           GOOD  ●         │                       │
│              │                           │                       │
│              │  Last updated: 2 min ago  │                       │
│              └───────────────────────────┘                       │
│                                                                  │
├───────── PRIORITY ISSUES (sorted by severity) ───────────────────┤
│                                                                  │
│  🔴 CRITICAL — 3 Breached Accounts        [View All →]          │
│     Dropbox · Amazon · MyOldForum                               │
│                                                                  │
│  🟠 HIGH — 4 High/Critical Risk Accounts   [View All →]         │
│     Bank of India · Coinbase · OldApp · DevTool                 │
│                                                                  │
│  🟡 MODERATE — 5 Finance Accounts with unknown 2FA [Review →]   │
│     PayPal · Stripe · Wise · Revolut · Coinbase                 │
│                                                                  │
│  💤 LOW — 12 Inactive Accounts             [Cleanup →]          │
│     Review and remove accounts unused for 180+ days             │
│                                                                  │
├─────────── SCORE BREAKDOWN ──────────────────────────────────────┤
│  Base score:                                  100                │
│  3 breaches (-15 each):                       -45               │
│  4 high-risk non-breached (-5 each):          -20               │
│  5 sensitive accounts unknown 2FA (-5):        -5               │
│  ─────────────────────────────────────────────────              │
│  Current score:                                82  GOOD          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9.3 — Security Action Items (Priority Queue)

Security issues are presented in a sorted, actionable list — highest severity first. Each item has a clear CTA:

| Severity | Issue Type | CTA |
|---|---|---|
| 🔴 P0 | Active breach on account | [View Breach] [Change Password →] |
| 🔴 P0 | Multiple breaches on same email | [View All] [Secure Email] |
| 🟠 P1 | Critical risk score (61–100) | [View Account] [Review] |
| 🟠 P1 | Finance account inactive > 1 year | [Open Account] [Delete Account] |
| 🟡 P2 | 2FA unknown on Finance/Dev account | [Enable 2FA →] |
| 🟡 P2 | High risk account (41–60) | [Review] |
| 💤 P3 | Inactive account (> 180 days) | [Review] [Cleanup] |
| ℹ️ P4 | Old account (> 5 years, low risk) | [Review] |

---

## 9.4 — Security Center Tabs

| Tab | Content |
|---|---|
| **Overview** | Score + Priority action list (default view) |
| **Breaches** | Full breached accounts list with breach details |
| **Risk Scores** | All accounts sorted by risk score descending |
| **2FA Status** | Accounts grouped by 2FA status (Enabled / Unknown / Unsupported) |
| **Inactive** | Accounts with last activity > 90 days |

---

## 9.5 — API Endpoints

```
GET /api/v1/security/score           → { score, label, breakdown, updated_at }
GET /api/v1/security/summary         → { breached_count, high_risk_count, inactive_sensitive_count, issues[] }
GET /api/v1/security/issues          → sorted list of actionable security items
```

---

## Acceptance Criteria

- [ ] Security score accurately computes based on the defined deduction algorithm.
- [ ] Score is recalculated within 30 seconds of a new breach detection or scan completion.
- [ ] Priority issue list is sorted by severity (P0 → P4) with no manual ordering needed.
- [ ] Each issue type displays the correct CTA buttons.
- [ ] Score breakdown section shows every deduction point with its reason.
- [ ] All 5 Security Center tabs render with accurate, real-time data.
- [ ] Score is cached in Redis for ≤ 5 minutes; stale scores are recomputed on-demand.
