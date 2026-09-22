# Phase 18 — Natural Language Assistant

> Ask My_Login anything about your accounts in plain English — and get instant, accurate answers.

---

## Objective

Enable users to query their entire account inventory using natural language commands, which are resolved to structured database queries and returned as both data results and UI filter state updates — without requiring LLM API calls for common queries.

---

## 18.1 — Architecture: Intent Classification First

> **Design Decision:** For the vast majority of queries, My_Login uses a **structured intent classifier** rather than calling an external LLM. This means:
> - Zero latency from external AI API calls
> - No user query data sent to third parties
> - Deterministic, auditable query behavior
> - LLM fallback only for truly ambiguous queries (opt-in)

```
User types: "Show me inactive shopping accounts"
                          │
                          ▼
             Intent Classifier (local, rule-based + ML)
                          │
              ┌───────────┴────────────────┐
              │  Intent: QUERY_ACCOUNTS    │
              │  Filters: {               │
              │    activity: 'inactive',   │
              │    category: 'shopping'    │
              │  }                         │
              └───────────┬────────────────┘
                          │
                          ▼
             Translate to SQL / Filter State
             (category=shopping&status=inactive)
                          │
              ┌───────────┴────────────────┐
              │ Execute DB query           │
              │ → 4 accounts found         │
              └───────────┬────────────────┘
                          │
                          ▼
             Natural Language Response:
             "Found 4 inactive Shopping accounts."
             + UI: Dashboard filtered to show them
```

---

## 18.2 — Intent Taxonomy

| Intent | Trigger Examples | SQL / Filter Output |
|---|---|---|
| `QUERY_ACCOUNTS` | "Show all accounts", "List my accounts" | No filter, all accounts |
| `QUERY_CATEGORY` | "Show my social accounts", "Finance accounts" | `category = 'social'` |
| `QUERY_INACTIVE` | "Accounts I haven't used in 6 months", "Inactive accounts" | `activity_status = 'inactive'` |
| `QUERY_BREACHED` | "Which accounts were breached?", "Show breaches" | `is_breached = true` |
| `QUERY_RISK` | "Show high risk accounts", "Most dangerous accounts" | `risk_level IN ('high','critical')` |
| `QUERY_EMAIL` | "Accounts on user@gmail.com", "What's on my work email?" | `user_email_id = {matched_email}` |
| `QUERY_COUNT` | "How many accounts do I have?", "Count my accounts" | Returns count |
| `QUERY_OLDEST` | "My oldest accounts", "When did I join GitHub?" | `ORDER BY first_detected_at ASC` |
| `QUERY_RECENT` | "Recently active accounts", "What have I used lately?" | `ORDER BY last_activity_at DESC` |
| `QUERY_2FA` | "Which accounts have 2FA?", "Accounts without 2FA" | `two_factor_status = 'enabled'/'unknown'` |
| `QUERY_SECURITY_SCORE` | "What's my security score?", "How safe am I?" | Returns security score |
| `QUERY_CLEANUP` | "What should I delete?", "Cleanup suggestions" | Redirects to Cleanup page |
| `QUERY_SERVICE` | "Find my Netflix account", "Do I have Spotify?" | `service.name ILIKE '%spotify%'` |

---

## 18.3 — Entity Extraction

Beyond intent, the classifier extracts named entities from the query:

```typescript
// modules/assistant/assistant.entities.ts
export function extractEntities(query: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  // Category extraction
  for (const category of ALL_CATEGORIES) {
    if (query.toLowerCase().includes(category.toLowerCase())) {
      entities.category = category;
      break;
    }
  }

  // Service name extraction
  for (const service of SERVICE_NAMES_CACHE) {
    if (query.toLowerCase().includes(service.toLowerCase())) {
      entities.serviceName = service;
      break;
    }
  }

  // Email extraction
  const emailMatch = query.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  if (emailMatch) entities.email = emailMatch[0];

  // Time expression extraction
  const timePatterns: [RegExp, string][] = [
    [/(\d+)\s*month/i, 'months'],
    [/(\d+)\s*year/i, 'years'],
    [/(\d+)\s*day/i, 'days'],
    [/6 months/i, '180 days'],
    [/last year|past year/i, '365 days'],
  ];
  for (const [pattern, unit] of timePatterns) {
    const m = query.match(pattern);
    if (m) {
      entities.timeRange = { value: m[1] ?? null, unit };
      break;
    }
  }

  return entities;
}
```

---

## 18.4 — Sample Query → Response Pairs

| User Query | Response |
|---|---|
| "Show me all accounts I haven't used in 6 months" | "Found **12 inactive accounts** (last active > 180 days). Dashboard filtered." |
| "Which shopping accounts are breached?" | "Found **2 breached Shopping accounts**: Amazon, OldShop. [View in Security Center]" |
| "How many developer accounts do I have?" | "You have **5 Developer accounts**: GitHub, GitLab, AWS, Vercel, Netlify." |
| "What's my security score?" | "Your current security score is **82 / 100 (GOOD)**. Main issue: 3 unresolved breaches." |
| "Find my Netflix account" | "Found **Netflix** via user@gmail.com. First seen: Nov 2020. Status: Active. [View Account]" |
| "Show accounts on my work email" | "Showing **18 accounts** linked to user@company.com." |
| "Which accounts should I delete?" | "**12 accounts** are inactive for 180+ days. [Go to Cleanup]" |
| "Do I have a GitHub account?" | "Yes. **GitHub** (Developer) — via user@gmail.com. Active 3 days ago. 2FA: ✅ Enabled." |
| "Show risky finance accounts" | "Found **3 Finance accounts** with HIGH or CRITICAL risk: Coinbase, OldBank, CryptoApp." |

---

## 18.5 — UI Design

```
┌─────────────────────────────────────────────────────────────┐
│  🧠 Ask My_Login                                     [Pro]  │
├─────────────────────────────────────────────────────────────┤
│  "Show me inactive shopping accounts"                  [→]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Found 4 inactive Shopping accounts                         │
│  (last active > 180 days)                                   │
│  ─────────────────────────────────────────                  │
│  [Logo] OldShop          Inactive 2yr    🟠 HIGH RISK        │
│  [Logo] FashionBrand     Inactive 1yr    🟡 MODERATE         │
│  [Logo] GadgetStore      Inactive 8mo    🟡 MODERATE         │
│  [Logo] BookStore        Inactive 7mo    🟢 LOW               │
│                                                             │
│  [ View in Dashboard ]  [ Go to Cleanup ]                   │
│                                                             │
│  ─────────────────────────────────────────                  │
│  Try:  "Show breached accounts"  ·  "What's my score?"     │
└─────────────────────────────────────────────────────────────┘
```

---

## 18.6 — LLM Fallback (Optional, Opt-In)

For queries that the intent classifier scores below 0.6 confidence, My_Login can optionally route to an LLM (e.g., Gemini Flash or GPT-4o mini) with a strict prompt:

```typescript
const SYSTEM_PROMPT = `
You are My_Login's account assistant. You have access to the user's account
inventory. Translate the user's natural language question into a JSON filter object.
Do not invent data. Do not discuss topics unrelated to the user's accounts.

Available filters: category, riskLevel, activityStatus, isBreached,
twoFactorStatus, emailAddress, serviceName, sortBy, limit.
`;
```

The LLM returns structured JSON → executed as a DB query. Raw account data is NEVER sent to the LLM — only the filter object is LLM-generated, the actual data query happens server-side.

This feature is opt-in only and clearly labeled "AI-powered" in the UI.

---

## Acceptance Criteria

- [ ] Intent classifier handles all 13 defined intents correctly on 95%+ of test cases.
- [ ] Entity extractor correctly identifies categories, service names, email addresses, and time ranges.
- [ ] Query response time is < 300ms for all structured intents (no LLM call).
- [ ] Dashboard filter state updates to match query results (deep-link URL updated).
- [ ] "Do I have X account?" returns accurate yes/no with account detail if yes.
- [ ] "How many accounts do I have?" returns accurate count without showing a list.
- [ ] LLM fallback is gated behind opt-in setting and clearly labeled.
- [ ] No user account data (account names, emails, subjects) is sent to external LLMs without opt-in.
- [ ] Ambiguous queries show a clarification prompt ("Did you mean: [options]?").
