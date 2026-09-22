# My_Login — Staged Development Roadmap (MERN Stack)

> **Core Principle:** Build the simplest production-capable implementation that satisfies each feature requirement. Use JavaScript/TypeScript throughout. No Python until ML genuinely requires it.

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Backend** | Node.js + Express.js | REST API server |
| **Database** | MongoDB + Mongoose | Document store |
| **Cache / Queue broker** | Redis | BullMQ-backed job queues |
| **Background jobs** | BullMQ (Node.js) | Replaces Celery |
| **Frontend** | ejs + html + css | Web client |
| **Mobile** | React Native + Expo | iOS + Android |
| **Container** | Docker + Docker Compose | No Kubernetes in MVP |
| **Reverse proxy** | NGINX | |
| **Validation** | Zod | Runtime schema validation |
| **Auth** | JWT + bcrypt | Sessions in MongoDB |
| **Python** | **Only if/when ML requires it** | Not in MVP |

---

## Development Tiers Overview

```
TIER 1 — MVP (Phases 0–11)
  Working, shippable product using MERN stack.
  No ML. No mobile yet. No subscription billing.

TIER 2 — Security & Retention (Phases 12–16)
  Cleanup, Notifications, 2FA signals, Settings, Digital Footprint.

TIER 3 — Intelligence (Phases 17–19)
  NL Assistant, ML Prep (Python only here if needed), ML Intelligence.

TIER 4 — Expansion (Phases 20–21)
  Local Password Audit, Mobile (React Native iOS + Android).
```

---

## ─────────────── TIER 1: MVP ───────────────

```
Phase 0   Foundation       (Node/Express/MongoDB/Docker setup)
Phase 1   Authentication   (JWT, Google OAuth, email/password)
Phase 2   Email Identity   (Multi-email, OTP)
Phase 3   Gmail Integration (OAuth, GmailProvider, token manager)
Phase 4   Account Discovery (Rule-based pipeline, dedup)
Phase 5   Service Catalog  (100–200 services, candidate flow)
Phase 6   Account Dashboard (Cards, detail panel)
Phase 7   Search & Filter  (Fuzzy search, URL state)
Phase 8   Breach Monitoring (HIBP, BreachProvider interface)
Phase 9   Risk & Security  (Deterministic rules, Security Center)
Phase 10  Activity         (Timelines, inactivity detection)
Phase 11  Privacy Foundation (Export, delete, disconnect)
```

### What MVP Delivers

A real user can:
1. Create an account and log in (Google OAuth or email/password)
2. Connect Gmail addresses
3. Run a scan that discovers services via email metadata
4. View a dashboard of discovered accounts with risk levels
5. Check for data breaches (HIBP)
6. View their overall security score
7. Export their data and delete their account

### What MVP Does NOT Include

```
❌ Python (Node.js only)
❌ ML / AI features
❌ Digital Footprint graph
❌ Mobile app (React Native comes in Tier 4)
❌ Web Push / FCM
❌ Subscription billing
❌ Elasticsearch / Meilisearch
❌ Kubernetes / microservices
❌ Multiple notification providers
```

### MVP Infrastructure

```
React Web ──► NGINX ──► Express.js ──► MongoDB
                                    ──► Redis ──► BullMQ Workers
                                                   ├── gmail worker
                                                   └── breach worker
```

---

## ─────────── TIER 2: Security & Retention ───────────

```
Phase 12  Account Cleanup
Phase 13  Notifications (In-App + Email only — NodeMailer/Resend)
Phase 14  2FA Signals
Phase 15  Settings (Full)
Phase 16  Digital Footprint (Simplified)
```

---

## ─────────── TIER 3: Intelligence ───────────

```
Phase 17  Natural Language Assistant (rule-based, no LLM)
Phase 18  ML Preparation (interfaces + candidate data)
Phase 19  ML Intelligence (Python microservice if needed — only here)
```

> **Python enters only in Phase 19** — and only as an isolated ML microservice if deterministic rules demonstrably fall short. All other tiers are 100% JavaScript/TypeScript.

---

## ─────────── TIER 4: Expansion ───────────

```
Phase 20  Local Password Audit (Pro, browser-only WebWorker)
Phase 21  Mobile (React Native — iOS + Android, after web API stable)
```

---

## Non-Negotiable Architectural Rules

| Rule | Rationale |
|---|---|
| Node.js + Express for all backend | One language (TypeScript) across web + mobile + backend |
| MongoDB for persistence | Flexible schema, natural JSON fit for account/event data |
| No Python until Phase 19 ML | Eliminates two-language operational overhead |
| Redis is cache + queue only | MongoDB is source of truth |
| BullMQ for background jobs | Native Node.js, same codebase as API |
| All external providers behind interfaces | `GmailProvider`, `BreachProvider`, `EmailProvider` |
| No ML in risk engine | 100% deterministic rules until Phase 19 |
| Every BullMQ job is idempotent | Retry-safe by design |
| Feature flags via env vars | `ENABLE_ML`, `ENABLE_ASSISTANT`, etc. |
| React Native after web API stable | No simultaneous web + mobile + backend |
| No Kubernetes, no Kafka, no Elasticsearch | Docker Compose + MongoDB text search is sufficient |

---

## Language Standards (Product Copy)

| ❌ Old | ✅ Correct |
|---|---|
| "Discover every account you've ever created" | "Discover accounts linked to your connected email history" |
| "You haven't used this account for 180 days" | "No qualifying activity detected for 180 days" |
| "All your accounts" | "Accounts found in connected mailboxes" |

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

## MVP Success Metrics

| Metric | Target (30 days post-launch) |
|---|---|
| Registered users | 1,000 |
| Gmail accounts connected | 600 |
| Avg accounts discovered per user | ≥ 25 |
| Breach checks completed | ≥ 500 |
| Dashboard load time (P95) | ≤ 1.5s |
| Gmail scan (10K emails) | ≤ 5 minutes |

---

## Scope Exclusions

```
❌ Python (except Phase 19 ML)
❌ FastAPI / Flask / Django
❌ PostgreSQL / MySQL / SQLite
❌ SQLAlchemy / Alembic
❌ Celery
❌ Kafka / RabbitMQ
❌ Kubernetes
❌ Elasticsearch
❌ ClickHouse / BigQuery
❌ Vector database
❌ API gateway
❌ Microservices (modular monolith)
❌ Separate ML server in MVP
```
