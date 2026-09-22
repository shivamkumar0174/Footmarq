# Footmarq

# My_Login — Digital Identity Hub

> **Discover accounts and services linked to your connected email history. Understand your risk. Clean up your digital footprint.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js + Express.js + javaScript|
| **Database** | MongoDB + Mongoose |
| **Cache / Queue** | Redis + BullMQ |
| **Frontend** | ejs + html + css  |
| **Mobile** | React Native + Expo (iOS + Android) |
| **Validation** | Zod |
| **Auth** | JWT + bcrypt + Google OAuth |
| **Containers** | Docker + Docker Compose |
| **Reverse proxy** | NGINX |
| **Python** | Only if Phase 19 ML requires it |

---

## What My_Login Does

```
Connect Gmail → Scan Email Metadata → Discover Accounts → Assess Risk → Take Action
```

1. **Account Discovery** — Scans Gmail metadata (sender, subject, timestamp — never body) to find services linked to your mailboxes.
2. **Breach Monitoring** — Checks emails against HIBP breach database weekly.
3. **Risk Scoring** — Transparent, deterministic per-account risk score (breach, inactivity, category, 2FA).
4. **Security Center** — Aggregate security score 0–100 with priority action list.
5. **Account Cleanup** — Guided flow to official deletion pages.

---

> ## ⚠️ CRITICAL LAUNCH REMINDER — READ BEFORE PHASE 3
>
> **The moment the "Connect Gmail" button works — stop and apply for Google App Verification immediately.**
>
> - `gmail.readonly` is a **Restricted Scope**. Google must personally review and approve your app before ANY real user (not just you) can connect Gmail.
> - Without approval → **your entire product is blocked for the public.** The app runs, but nobody can use it.
> - Approval takes **2 to 8 weeks.** Google can reject and make you start over.
> - You need: ✅ Live Privacy Policy URL  ✅ Demo video of Gmail connect flow  ✅ Written justification for the scope
>
> **Do NOT wait until launch day. Apply the moment Phase 3 is working.**
> See: [`plans/04_phase3_gmail_integration.md`](plans/04_phase3_gmail_integration.md) → Section 3.1

---

## What My_Login Does NOT Do

- Store passwords
- Read email body content (metadata only)
- Log in to services on your behalf
- Automate account deletions
- Guarantee discovery of every account (only what exists in connected mailboxes)

---

## Development Tiers

| Tier | Phases | Scope |
|---|---|---|
| **Tier 1 — MVP** | 0–11 | Core product — MERN stack |
| **Tier 2 — Security & Retention** | 12–16 | Cleanup, Notifications, 2FA, Settings, Footprint |
| **Tier 3 — Intelligence** | 17–19 | Assistant, ML Prep, ML (Python only if needed) |
| **Tier 4 — Expansion** | 20–21 | Password Audit (Pro), Mobile (React Native) |

---

## Architecture — Modular Monolith (Node.js)

```
backend/src/
├── config/          ← env, feature flags, DB connection
├── middleware/       ← auth, error handler, rate limit, CORS, request ID
├── modules/
│   ├── auth/        ← JWT, Google OAuth, sessions
│   ├── users/       ← Profile, settings
│   ├── emails/      ← Multi-email identity, OTP
│   ├── gmail/       ← GmailProvider interface + Google implementation
│   ├── discovery/   ← Pre-filter, catalog match, pattern match, dedup
│   ├── services/    ← Service catalog (100–200 curated)
│   ├── accounts/    ← Discovered accounts, events, activity
│   ├── security/    ← Security score engine
│   ├── breaches/    ← BreachProvider interface + HIBP implementation
│   ├── risk/        ← Deterministic rule-based risk engine
│   ├── notifications/ ← In-App + Email (Tier 2)
│   ├── privacy/     ← Export, delete, disconnect
│   └── settings/    ← User preferences
├── jobs/            ← BullMQ workers (gmail, breach, maintenance)
├── shared/          ← Types, utils, constants
└── app.ts           ← Express app factory
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Node.js throughout | One language (TypeScript) for backend, frontend, and mobile shared code |
| MongoDB | Flexible document model fits account/event data naturally; no schema migrations |
| BullMQ over Celery | Native Node.js job queue — same codebase, same language |
| Metadata-only Gmail scan | Privacy, no email body storage |
| No password storage | Zero credential liability |
| Deterministic risk engine | Explainable, testable, no ML cost |
| `GmailProvider`, `BreachProvider`, `EmailProvider` protocols | Swap implementations without changing business logic |
| Python deferred to Phase 19 | Only introduced if ML genuinely needs it, as an isolated service |

---

## Feature Flags

```
ENABLE_ML=false
ENABLE_ASSISTANT=false
ENABLE_FOOTPRINT=false
ENABLE_PASSWORD_AUDIT=false
ENABLE_PUSH_NOTIFICATIONS=false
```

---

## Plans Index

### Tier 1 — MVP
| File | Phase |
|---|---|
| `plans/01_phase0_foundation.md` | Foundation (Node/Express/MongoDB/Docker) |
| `plans/02_phase1_authentication.md` | Authentication (JWT, OAuth) |
| `plans/03_phase2_email_management.md` | Email Identity |
| `plans/04_phase3_gmail_integration.md` | Gmail Integration |
| `plans/05_phase4_account_discovery.md` | Account Discovery |
| `plans/06_phase5_service_database.md` | Service Catalog |
| `plans/07_phase6_account_dashboard.md` | Account Dashboard |
| `plans/08_phase7_search_filtering.md` | Search & Filtering |
| `plans/09_phase8_breach_monitoring.md` | Breach Monitoring |
| `plans/12_phase11_risk_engine.md` | Risk & Security Center |
| `plans/14_phase13_account_activity.md` | Activity & Inactivity |
| `plans/21_phase20_privacy_center.md` | Privacy Foundation |

### Architecture
| File | Description |
|---|---|
| `plans/23_database_architecture.md` | MongoDB schemas, indexes, MVP vs later |
| `plans/24_backend_architecture.md` | Node/Express modular monolith |
| `plans/25_background_processing.md` | BullMQ 3-queue MVP architecture |
| `plans/26_mobile_strategy.md` | React Native iOS + Android (Tier 4) |

### Market
| File | Description |
|---|---|
| `market/competitive_analysis.md` | Market positioning, personas |
| `market/monetization.md` | Pricing tiers, Stripe |
| `market/go_to_market.md` | Launch strategy |
