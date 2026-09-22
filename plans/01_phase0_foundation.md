# Phase 0 — Foundation & Infrastructure

> Before a single user-facing feature is built, the architecture must be correct. Retrofitting security or data architecture later is expensive.

---

## Objective

Establish the complete development environment, project scaffold, Docker infrastructure, and CI/CD pipeline so that every subsequent phase builds on a solid, tested base.

---

## 0.1 — Monorepo Structure

```
mylogin/
├── backend/          ← Node.js + Express + TypeScript
├── frontend/         ← React + Vite + TypeScript
├── packages/
│   └── shared/       ← Shared types + API client (used by frontend & mobile)
├── mobile/           ← React Native (Tier 4 only)
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-frontend.yml
│       └── deploy-backend.yml
└── .env.example
```

---

## 0.2 — Backend Scaffold (Node.js + Express + TypeScript)

### Directory Layout

```
backend/
├── src/
│   ├── app.ts                      ← Express app factory
│   ├── server.ts                   ← HTTP server + graceful shutdown
│   ├── config/
│   │   ├── env.ts                  ← Zod-validated env vars
│   │   ├── database.ts             ← Mongoose connect/disconnect
│   │   ├── redis.ts                ← ioredis connection
│   │   └── feature-flags.ts        ← ENABLE_ML, ENABLE_ASSISTANT, etc.
│   ├── middleware/                  ← auth, error, rate-limit, cors, request-id, validate
│   ├── modules/                    ← One folder per domain feature
│   │   ├── auth/
│   │   ├── users/
│   │   ├── emails/
│   │   ├── gmail/
│   │   ├── discovery/
│   │   ├── services/
│   │   ├── accounts/
│   │   ├── security/
│   │   ├── breaches/
│   │   ├── risk/
│   │   ├── privacy/
│   │   └── settings/
│   ├── jobs/                       ← BullMQ workers + scheduler
│   └── shared/                     ← Types, utils, error classes, constants
├── __tests__/
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### Key Dependencies

```json
{
  "dependencies": {
    "express": "^4.19",
    "mongoose": "^8",
    "ioredis": "^5",
    "bullmq": "^5",
    "jsonwebtoken": "^9",
    "bcrypt": "^5",
    "zod": "^3",
    "google-auth-library": "^9",
    "googleapis": "^140",
    "nodemailer": "^6",
    "speakeasy": "^2",
    "qrcode": "^1",
    "helmet": "^8",
    "cors": "^2",
    "express-rate-limit": "^7",
    "winston": "^3",
    "node-cron": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/express": "^4",
    "@types/node": "^20",
    "ts-node": "^10",
    "tsx": "^4",
    "jest": "^29",
    "ts-jest": "^29",
    "supertest": "^6",
    "@types/supertest": "^6",
    "eslint": "^9",
    "@typescript-eslint/eslint-plugin": "^7",
    "prettier": "^3"
  }
}
```

---

## 0.3 — Frontend Scaffold (React + Vite + TypeScript)

### Stack

- Vite + React 18 + TypeScript
- CSS Modules or Vanilla CSS (no Tailwind unless explicitly requested)
- React Router v6
- Framer Motion (animations)
- TanStack Query (server state / API calls)
- Zustand (client state)
- Axios (HTTP)

### Directory Layout

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/           ← Design system primitives (Button, Card, Badge…)
│   │   └── shared/       ← Reusable feature components
│   ├── pages/
│   ├── features/         ← Feature-scoped modules (auth, accounts, security…)
│   ├── hooks/
│   ├── stores/           ← Zustand stores
│   ├── api/              ← Axios API client layer
│   ├── types/            ← (can import from packages/shared)
│   ├── utils/
│   └── main.tsx
├── index.html
├── vite.config.ts
└── tsconfig.json
```

---

## 0.4 — Database Setup (MongoDB)

```yaml
# docker-compose.yml
services:
  mongodb:
    image: mongo:7
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: mylogin
      MONGO_INITDB_ROOT_PASSWORD: secret
      MONGO_INITDB_DATABASE: mylogin_dev
```

No migrations needed. Mongoose schemas enforce structure at the application layer. Indexes are declared in schema definitions and applied via `model.syncIndexes()` on startup.

---

## 0.5 — Redis Setup

Used for:
- BullMQ job queue broker
- API response caching (service catalog, dashboard summary)
- Rate limiting counters
- Temporary locks (duplicate scan prevention)

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

---

## 0.6 — Environment Configuration

### `.env.example`

```ini
# Application
NODE_ENV=development
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173

# MongoDB
MONGODB_URI=mongodb://mylogin:secret@localhost:27017/mylogin_dev?authSource=admin

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=change-me-to-a-secure-64-char-random-string
JWT_REFRESH_SECRET=change-me-to-a-different-64-char-random-string

# Google OAuth (Login)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Gmail OAuth (Scanning — separate app from login if needed)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

# External APIs
HIBP_API_KEY=

# Email (Resend)
RESEND_API_KEY=

# Encryption (AES-256 for OAuth tokens at rest)
ENCRYPTION_KEY=change-me-to-a-32-byte-hex-string

# Feature Flags
ENABLE_ML=false
ENABLE_ASSISTANT=false
ENABLE_FOOTPRINT=false
ENABLE_PASSWORD_AUDIT=false
ENABLE_PUSH_NOTIFICATIONS=false
```

### Env Validation (Zod — runs at startup)

```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV:         z.enum(['development', 'production', 'test']),
  PORT:             z.coerce.number().default(4000),
  MONGODB_URI:      z.string().url(),
  REDIS_URL:        z.string().url(),
  JWT_SECRET:       z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  HIBP_API_KEY:     z.string(),
  RESEND_API_KEY:   z.string(),
  ENCRYPTION_KEY:   z.string().length(64),
  ENABLE_ML:        z.coerce.boolean().default(false),
  ENABLE_ASSISTANT: z.coerce.boolean().default(false),
  ENABLE_FOOTPRINT: z.coerce.boolean().default(false),
  ENABLE_PASSWORD_AUDIT: z.coerce.boolean().default(false),
  ENABLE_PUSH_NOTIFICATIONS: z.coerce.boolean().default(false),
});

export const env = envSchema.parse(process.env);
```

If any required variable is missing, the app **fails fast at startup** with a clear error. Never silently starts with bad config.

---

## 0.7 — Docker Compose (Full Local Stack)

```yaml
version: "3.9"
services:
  api:
    build: ./backend
    command: npm run dev
    ports: ["4000:4000"]
    volumes: ["./backend/src:/app/src"]
    environment:
      - MONGODB_URI=mongodb://mylogin:secret@mongodb:27017/mylogin_dev?authSource=admin
      - REDIS_URL=redis://redis:6379
    depends_on: [mongodb, redis]

  worker:
    build: ./backend
    command: npm run workers
    restart: always
    depends_on: [mongodb, redis]

  scheduler:
    build: ./backend
    command: npm run scheduler
    restart: always
    depends_on: [mongodb, redis]

  bullboard:
    build: ./backend
    command: npm run bullboard
    ports: ["3001:3001"]
    depends_on: [redis]

  frontend:
    build: ./frontend
    command: npm run dev
    ports: ["5173:5173"]
    volumes: ["./frontend/src:/app/src"]

  mongodb:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongodb_data:/data/db]
    environment:
      MONGO_INITDB_ROOT_USERNAME: mylogin
      MONGO_INITDB_ROOT_PASSWORD: secret
      MONGO_INITDB_DATABASE: mylogin_dev

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

volumes:
  mongodb_data:
```

---

## 0.8 — Security Baseline

| Requirement | Implementation |
|---|---|
| HTTPS everywhere | NGINX TLS termination in production |
| Secrets not in code | `.env` + secrets manager (e.g. Railway vars) |
| NoSQL injection prevention | Mongoose sanitize input; never pass raw user strings to `$where` |
| XSS prevention | React's built-in escaping + `helmet` CSP headers |
| CSRF protection | SameSite=Strict cookies for refresh tokens |
| Rate limiting | `express-rate-limit` on all auth + scan endpoints |
| Password hashing | `bcrypt` cost factor 12 |
| JWT key rotation | Documented procedure |
| CORS policy | Whitelist only `ALLOWED_ORIGINS` — never `"*"` |
| Dependency scanning | GitHub Dependabot enabled |
| OAuth token storage | AES-256-GCM encrypted in MongoDB — never plaintext |

---

## 0.9 — Logging & Observability

### Logging (Winston)

```typescript
// shared/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()     // Structured JSON in production
  ),
  transports: [new winston.transports.Console()],
});
```

### Error Tracking — Sentry

- `@sentry/node` in backend
- `@sentry/react` in frontend
- Source maps uploaded for frontend errors

### Health Check

```typescript
router.get('/health', async (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'ok' : 'error';
  const redis = await redisClient.ping() === 'PONG' ? 'ok' : 'error';
  const status = dbState === 'ok' && redis === 'ok' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({ status, db: dbState, redis });
});
```

---

## 0.10 — CI/CD Pipeline (GitHub Actions)

### `ci.yml` — Every PR

```yaml
jobs:
  backend:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: docker build ./backend   # Build smoke test

  frontend:
    steps:
      - run: npm ci && npm run lint && npm run build
```

### `deploy-backend.yml` — Merge to `main`

```yaml
- Build Docker image
- Push to container registry
- Deploy to Railway / Render
```

---

## package.json Scripts

```json
{
  "scripts": {
    "dev":        "tsx watch src/server.ts",
    "build":      "tsc -p tsconfig.json",
    "start":      "node dist/server.js",
    "workers":    "node dist/jobs/worker-runner.js",
    "scheduler":  "node dist/jobs/scheduler.js",
    "bullboard":  "node dist/jobs/bullboard.js",
    "test":       "jest",
    "lint":       "eslint src --ext .ts",
    "typecheck":  "tsc --noEmit"
  }
}
```

---

## Acceptance Criteria

- [ ] `docker-compose up` starts the entire local stack (MongoDB, Redis, API, Frontend, Workers) with no manual steps.
- [ ] `GET /health` returns `{ status: "ok", db: "ok", redis: "ok" }` within 5 seconds of startup.
- [ ] Zod env validation fails fast if any required environment variable is missing.
- [ ] Mongoose indexes sync on startup (no manual DDL).
- [ ] BullMQ workers connect and register all 3 queues (gmail, breach, maintenance).
- [ ] Frontend renders correctly at `http://localhost:5173`.
- [ ] GitHub Actions CI passes on a sample PR (lint + typecheck + tests + docker build).
- [ ] All secrets are in `.env` only — `.env` is in `.gitignore`.
- [ ] `README.md` contains complete local setup instructions (clone → docker-compose up).
- [ ] No Python, no `requirements.txt`, no `Dockerfile` with `pip install` anywhere.
