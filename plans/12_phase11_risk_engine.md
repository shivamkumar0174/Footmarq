# Phase 9 — Risk Engine & Security Center

> Two related features built together: a deterministic, transparent risk score per account and an aggregate security health score for the user.

---

## Goal

Compute a per-account risk score (0–100) based on weighted security signals using deterministic rules only, roll it up into an overall security score (0–100), and present both in a unified Security Center.

---

## Design Principle: 100% Deterministic

> Keep the risk engine completely rule-based. Do not add ML to risk scoring until real-world data demonstrates that rules are insufficient — and even then, explanations must remain visible to the user.

The deterministic approach is:
- Easier to test (unit tests for every factor)
- Transparent to users (show exactly why a score is what it is)
- Cheaper to run (no model serving)
- Correct enough for MVP (breach + inactivity + category covers >80% of meaningful risk)

---

## Features

### 1. Account Risk Score — Factor Matrix

Risk is additive and capped at 100:

| # | Factor | Condition | Points | Rationale |
|---|---|---|---|---|
| 1 | **Active breach** | Account in 1 confirmed, unresolved breach | +35 | Credential exposure — highest direct risk |
| 2 | **Multiple breaches** | Account in 2+ unresolved breaches | +10 bonus | Compound exposure |
| 3 | **Sensitive category** | Finance, Developer, Healthcare | +20 | High-value target for credential stuffing |
| 4 | **2FA unknown** | Service supports 2FA AND `two_factor_status = 'unknown'` | +15 | Unconfirmed protection on valuable account |
| 5 | **Long inactivity** | No qualifying activity > 180 days | +15 | Forgotten = unmonitored |
| 6 | **Old account** | First detected > 5 years ago | +5 | Older credentials may be reused |
| 7 | **Past security event** | PASSWORD_RESET or SECURITY_ALERT in event history | +5 | Signals a past concern |

> **Critical rule:** Factor 4 adds points only when `two_factor_status = 'unknown'`, NOT when `= 'unsupported'`. Unsupported means 2FA doesn't exist for this service — the user did nothing wrong.

```typescript
// risk/risk.engine.ts
const SENSITIVE_CATEGORIES = ['Finance', 'Developer', 'Healthcare'];

interface RiskFactor { factor: string; points: number; }
interface RiskResult { score: number; level: string; factors: RiskFactor[]; }

export async function calculateRiskScore(
  account: IAccount,
  service: IService | null
): Promise<RiskResult> {
  let score = 0;
  const factors: RiskFactor[] = [];

  // Factor 1 & 2: Breach
  if (account.isBreached) {
    score += 35;
    factors.push({ factor: 'Active data breach', points: 35 });
    if (account.breachedCount >= 2) {
      score += 10;
      factors.push({ factor: `${account.breachedCount} breaches (compound)`, points: 10 });
    }
  }

  // Factor 3: Category sensitivity
  if (service && SENSITIVE_CATEGORIES.includes(service.category)) {
    score += 20;
    factors.push({ factor: `Sensitive category: ${service.category}`, points: 20 });
  }

  // Factor 4: 2FA unknown (NOT unsupported)
  if (service?.supports2FA && account.twoFactorStatus === 'unknown') {  // only 'unknown', never 'unsupported'
    score += 15;
    factors.push({ factor: '2FA status unconfirmed on 2FA-capable service', points: 15 });
  }

  // Factor 5: Inactivity
  if (account.lastActivityAt) {
    const daysInactive = Math.floor((Date.now() - account.lastActivityAt.getTime()) / 86_400_000);
    if (daysInactive > 180) {
      score += 15;
      factors.push({ factor: `No qualifying activity for ${daysInactive} days`, points: 15 });
    }
  }

  // Factor 6: Account age
  const ageYears = (Date.now() - account.firstDetectedAt.getTime()) / (365 * 86_400_000);
  if (ageYears > 5) {
    score += 5;
    factors.push({ factor: `Account is ${ageYears.toFixed(1)} years old`, points: 5 });
  }

  // Factor 7: Past security event
  const hasPastEvent = await SecurityEvent.exists({
    accountId: account._id,
    eventType: { $in: ['PASSWORD_RESET', 'SECURITY_ALERT'] }
  });
  if (hasPastEvent) {
    score += 5;
    factors.push({ factor: 'Past password reset or security alert detected', points: 5 });
  }

  const finalScore = Math.min(score, 100);
  const level = finalScore >= 61 ? 'critical'
    : finalScore >= 41 ? 'high'
    : finalScore >= 21 ? 'moderate'
    : 'low';

  return { score: finalScore, level, factors };
}
```

### 2. Risk Level Classification

| Score | Level | Color | Meaning |
|---|---|---|---|
| 0–20 | **LOW** | `#22c55e` green | Unbreached, active — no action needed |
| 21–40 | **MODERATE** | `#f59e0b` amber | Some signals — review recommended |
| 41–60 | **HIGH** | `#f97316` orange | Multiple factors — action recommended |
| 61–100 | **CRITICAL** | `#ef4444` red | Active breach or compound risk — act now |

### 3. Risk Score Update Flow

Risk is recalculated:
- After every Gmail scan completion (all accounts for that `userEmailId`) — inline in the scan job
- After a breach is created or marked resolved (specific account only) — inline after DB update
- By the daily **BullMQ maintenance job** (`batch_risk` type) for accounts that crossed the 180-day threshold

> **Synchronization rule:** `account.isBreached` is ALWAYS updated before calling `calculateRiskScore()`. Risk score reads `account.isBreached` — it does not query the `breaches` collection directly.

### 4. Security Score (User-Level Aggregate)

```typescript
// security/security.score.ts
interface ScoreDeduction { reason: string; points: number; }
interface SecurityScoreResult { score: number; label: string; deductions: ScoreDeduction[]; }

export async function calculateSecurityScore(userId: string): Promise<SecurityScoreResult> {
  let score = 100;
  const deductions: ScoreDeduction[] = [];

  const accounts = await Account.find({
    userId,
    isDeletedByUser: false,
    isArchived: false,
  }).populate('serviceId').lean();

  // Breach penalties
  const breached = accounts.filter(a => a.isBreached);
  if (breached.length > 0) {
    const penalty = Math.min(breached.length * 15, 45);
    score -= penalty;
    deductions.push({ reason: `${breached.length} breached accounts`, points: -penalty });
  }

  // High/Critical risk (non-breached)
  const highRisk = accounts.filter(a =>
    ['high', 'critical'].includes(a.riskLevel) && !a.isBreached
  );
  if (highRisk.length > 0) {
    const penalty = Math.min(highRisk.length * 5, 15);
    score -= penalty;
    deductions.push({ reason: `${highRisk.length} high-risk accounts`, points: -penalty });
  }

  // Sensitive + unknown 2FA (only 'unknown', never 'unsupported')
  const sensitiveNo2FA = accounts.filter(a => {
    const svc = a.serviceId as IService | null;
    return svc && SENSITIVE_CATEGORIES.includes(svc.category)
      && a.twoFactorStatus === 'unknown';
  });
  if (sensitiveNo2FA.length > 0) {
    const penalty = Math.min(sensitiveNo2FA.length * 5, 15);
    score -= penalty;
    deductions.push({ reason: `${sensitiveNo2FA.length} sensitive accounts with unknown 2FA`, points: -penalty });
  }

  const finalScore = Math.max(score, 0);
  const label = finalScore >= 85 ? 'EXCELLENT'
    : finalScore >= 70 ? 'GOOD'
    : finalScore >= 50 ? 'MODERATE'
    : finalScore >= 30 ? 'AT RISK'
    : 'CRITICAL';

  return { score: finalScore, label, deductions };
}
```

### 5. Security Score Tiers

| Range | Label | Icon |
|---|---|---|
| 85–100 | EXCELLENT | ✅ |
| 70–84 | GOOD | 🟢 |
| 50–69 | MODERATE | 🟡 |
| 30–49 | AT RISK | 🟠 |
| 0–29 | CRITICAL | 🔴 |

### 6. Security Center UI

```
SECURITY CENTER

              ┌───────────────────────────┐
              │      SECURITY SCORE       │
              │                           │
              │         82 / 100          │
              │           GOOD  🟢        │
              └───────────────────────────┘

PRIORITY ISSUES (sorted by severity)
─────────────────────────────────────────────────
🔴 CRITICAL — 3 Breached Accounts        [View →]
   Dropbox · Amazon · OldForum

🟠 HIGH — 4 High/Critical Risk Accounts  [View →]
   Bank account · Coinbase · DevTool · OldApp

🟡 MODERATE — 5 Finance with unknown 2FA [Review →]
   PayPal · Wise · Stripe · Revolut · Coinbase

💤 LOW — 12 accounts with no activity    [Cleanup →]
   No qualifying activity detected for 180+ days

SCORE BREAKDOWN
─────────────────────────────────────────────────
Base score:                               100
3 breached accounts (-15 each):           -45
4 high-risk accounts (-5 each):           -20
5 sensitive + unknown 2FA (-5 total):      -5 (capped)
─────────────────────────────────────────────────
Current:                                   82  GOOD
```

---

## Database Changes

No new tables. Updates to existing `accounts` table (already include `risk_score`, `risk_level`, `risk_factors` JSONB).

New column to add in this phase:
```sql
-- Already in Phase 4 schema, but confirm these exist:
-- accounts.risk_score INT DEFAULT 0
-- accounts.risk_level VARCHAR(20) DEFAULT 'low'
-- accounts.risk_factors JSONB
-- accounts.last_risk_calculated_at TIMESTAMPTZ
```

---

## API Changes

```
GET /api/v1/security/score
    → { score, label, breakdown: [{reason, points}], updated_at }

GET /api/v1/security/summary
    → { breached_count, high_risk_count, sensitive_no_2fa_count, inactive_count, issues[] }

GET /api/v1/security/issues
    → sorted list of actionable items (P0 → P3)
```

---

## Background Jobs

Risk recalculation is triggered:
1. **Synchronously** (after scan/breach change, single account) — inline DB execution
2. **Daily batch** via BullMQ maintenance queue — `batch_recalculate_risk`

No separate `risk_calc` queue in MVP.

---

## Dependencies

- Phase 4 (Account Discovery) — accounts must exist
- Phase 8 (Breach Monitoring) — `is_breached` and breach state must be current before risk runs

---

## What Is Intentionally NOT Implemented

```
❌ ML-based risk scoring
❌ XGBoost / gradient boosting model
❌ Feature store or training pipeline
❌ A/B testing of different risk weights
❌ Drift detection
❌ Separate risk_calc BullMQ queue (uses maintenance queue)
❌ Real-time streaming score updates (30-second cache is fine)
❌ Risk score webhooks
```

---

## Cost / Complexity Considerations

- 100% rule-based: zero model serving cost, zero training cost.
- Risk factors stored as JSONB on the account row — no join needed to render the breakdown.
- Batch recalculation via maintenance queue shares workers with cleanup and digest — no extra worker process.
- Security score is recomputed on-demand (< 50ms) and cached in Redis for 60 seconds.

---

## Acceptance Criteria

- [ ] Risk score correctly computes with all 7 factors.
- [ ] Factor 4 adds +15 only for `two_factor_status = 'unknown'` — NOT for `'unsupported'`.
- [ ] `accounts.risk_factors` JSONB stores the full deduction breakdown on every recalculation.
- [ ] Security score correctly aggregates from all non-archived, non-deleted accounts.
- [ ] Risk level badge (LOW / MODERATE / HIGH / CRITICAL) updates within 60 seconds of a score change.
- [ ] Security Center renders priority issues sorted P0 → P3.
- [ ] Score breakdown section shows every deduction with its reason.
- [ ] Security score recalculates within 30 seconds of a breach state change.
- [ ] Daily BullMQ batch job recalculates stale risk scores (> 24h since last calculation).
