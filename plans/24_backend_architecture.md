# Backend Architecture — My_Login (Node.js + Express + TypeScript)

> Modular monolith using Express.js, MongoDB (Mongoose), Redis (BullMQ), and TypeScript. One language across backend, frontend, and mobile.

---

## 1. Why Node.js + Express (Not Python/FastAPI)

| Factor | Node.js + Express | Python + FastAPI |
|---|---|---|
| Language consistency | ✅ TypeScript everywhere (web, mobile, backend) | ❌ Python backend + JS frontend |
| Shared code with React/RN | ✅ `packages/shared` types work natively | ❌ Needs code generation or OpenAPI |
| BullMQ job queues | ✅ Same language, same codebase | ❌ Separate Celery process in Python |
| Developer context switching | ✅ None (one language) | ❌ Two languages, two ecosystems |
| MongoDB driver | ✅ First-class (Mongoose) | ⚠️ Motor (async, less mature) |
| Ecosystem for REST APIs | ✅ Mature, well-supported | ✅ Also mature |

Python is **deferred to Phase 19** and only if ML genuinely requires it — as an isolated service with no shared codebase footprint in the main app.

---

## 2. Directory Structure

```
backend/
├── src/
│   ├── app.ts                      ← Express app factory (middleware + router registration)
│   ├── server.ts                   ← HTTP server + graceful shutdown
│   │
│   ├── config/
│   │   ├── env.ts                  ← Zod-validated environment variables
│   │   ├── database.ts             ← MongoDB connection
│   │   ├── redis.ts                ← Redis connection (ioredis)
│   │   └── feature-flags.ts        ← ENABLE_ML, ENABLE_ASSISTANT, etc.
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts      ← JWT verification, attach req.user
│   │   ├── error.middleware.ts     ← Global error handler, standard error envelope
│   │   ├── rate-limit.middleware.ts ← express-rate-limit
│   │   ├── cors.middleware.ts      ← Whitelist-only CORS
│   │   ├── request-id.middleware.ts ← X-Request-ID header injection
│   │   └── validate.middleware.ts  ← Zod request body/query validation
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.router.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.schema.ts      ← Mongoose model
│   │   │   ├── auth.validation.ts  ← Zod schemas
│   │   │   └── oauth/
│   │   │       ├── google.ts       ← Google login OAuth
│   │   │       └── gmail.ts        ← Gmail scope OAuth (separate flow)
│   │   │
│   │   ├── users/
│   │   │   ├── users.router.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.schema.ts
│   │   │   └── users.validation.ts
│   │   │
│   │   ├── emails/
│   │   │   ├── emails.router.ts
│   │   │   ├── emails.service.ts
│   │   │   ├── emails.schema.ts
│   │   │   └── emails.validation.ts
│   │   │
│   │   ├── gmail/
│   │   │   ├── gmail.router.ts
│   │   │   ├── gmail.provider.ts   ← GmailProvider interface + GoogleGmailProvider
│   │   │   ├── gmail.token.ts      ← AES-256 token encrypt/decrypt/refresh
│   │   │   ├── gmail.scanner.ts    ← Inbox query + metadata extraction
│   │   │   └── gmail.jobs.ts       ← BullMQ job definitions
│   │   │
│   │   ├── discovery/
│   │   │   ├── discovery.pipeline.ts    ← Orchestrates all stages
│   │   │   ├── discovery.prefilter.ts   ← Blocklist (newsletters, marketing)
│   │   │   ├── discovery.catalog.ts     ← Domain exact match via service catalog
│   │   │   ├── discovery.patterns.ts    ← Regex subject patterns
│   │   │   ├── discovery.classifier.ts  ← AccountClassifier interface (for future ML)
│   │   │   ├── discovery.normalizer.ts  ← Domain → canonical service
│   │   │   └── discovery.dedup.ts       ← messageId + account-level dedup
│   │   │
│   │   ├── services/
│   │   │   ├── services.router.ts
│   │   │   ├── services.service.ts
│   │   │   ├── services.schema.ts
│   │   │   └── seed/
│   │   │       └── services.json        ← 100–200 curated service records
│   │   │
│   │   ├── accounts/
│   │   │   ├── accounts.router.ts
│   │   │   ├── accounts.service.ts
│   │   │   ├── accounts.schema.ts
│   │   │   └── accounts.validation.ts
│   │   │
│   │   ├── security/
│   │   │   ├── security.router.ts
│   │   │   └── security.score.ts        ← calculateSecurityScore()
│   │   │
│   │   ├── breaches/
│   │   │   ├── breaches.router.ts
│   │   │   ├── breaches.service.ts
│   │   │   ├── breaches.schema.ts
│   │   │   └── providers/
│   │   │       ├── breach.provider.ts   ← BreachProvider interface
│   │   │       └── hibp.provider.ts     ← HIBPBreachProvider implementation
│   │   │
│   │   ├── risk/
│   │   │   └── risk.engine.ts           ← calculateRiskScore() — rule-based, no ML
│   │   │
│   │   ├── notifications/               ← Added in Phase 13 (Tier 2)
│   │   │   ├── notifications.router.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.schema.ts
│   │   │   └── providers/
│   │   │       ├── email.provider.ts    ← EmailProvider interface
│   │   │       └── resend.provider.ts   ← ResendEmailProvider implementation
│   │   │
│   │   ├── privacy/
│   │   │   ├── privacy.router.ts
│   │   │   └── privacy.service.ts
│   │   │
│   │   └── settings/
│   │       ├── settings.router.ts
│   │       └── settings.service.ts
│   │
│   ├── jobs/                            ← BullMQ workers
│   │   ├── queues.ts                    ← Queue + Worker definitions
│   │   ├── gmail.worker.ts
│   │   ├── breach.worker.ts
│   │   └── maintenance.worker.ts
│   │
│   ├── shared/
│   │   ├── types.ts                     ← Shared TypeScript types
│   │   ├── utils.ts                     ← Encryption, token gen, etc.
│   │   ├── constants.ts
│   │   └── errors.ts                    ← AppError class, error codes
│   │
│   └── __tests__/
│       ├── unit/
│       └── integration/
│
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 3. Provider Interfaces (TypeScript)

All external dependencies must be behind a TypeScript interface:

```typescript
// gmail/gmail.provider.ts
export interface GmailProvider {
  listMessages(query: string, pageToken?: string): Promise<MessagePage>;
  getMessageMetadata(messageId: string): Promise<MessageMetadata>;
}

export class GoogleGmailProvider implements GmailProvider {
  async listMessages(query, pageToken) { /* Google API */ }
  async getMessageMetadata(messageId) { /* Google API */ }
}

// breaches/providers/breach.provider.ts
export interface BreachProvider {
  checkEmail(email: string): Promise<BreachRecord[]>;
}

export class HIBPBreachProvider implements BreachProvider {
  async checkEmail(email: string): Promise<BreachRecord[]> {
    const res = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${email}`,
      { headers: { 'hibp-api-key': process.env.HIBP_API_KEY!, 'User-Agent': 'My_Login/1.0' } }
    );
    if (res.status === 404) return [];
    return res.json();
  }
}

// notifications/providers/email.provider.ts
export interface EmailProvider {
  send(to: string, subject: string, html: string, text: string): Promise<boolean>;
}

export class ResendEmailProvider implements EmailProvider {
  async send(to, subject, html, text) { /* Resend SDK */ }
}
```

---

## 4. Layered Architecture (Per Module)

```
HTTP Request
     │
     ▼
  Router       ← express.Router() — validate input, call service
     │
     ▼
  Service      ← Business logic, no DB calls directly
     │
     ▼
  Schema       ← Mongoose model (DB access)
```

Example:
```typescript
// accounts.router.ts
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const account = await AccountService.getById(req.params.id, req.user.id);
    res.json({ data: account });
  } catch (err) { next(err); }
});

// accounts.service.ts
export class AccountService {
  static async getById(accountId: string, userId: string) {
    const account = await Account.findOne({ _id: accountId, userId })
      .populate('service').lean();
    if (!account) throw new AppError('ACCOUNT_NOT_FOUND', 404);
    return account;
  }
}
```

---

## 5. Validation with Zod

```typescript
// emails/emails.validation.ts
import { z } from 'zod';

export const AddEmailSchema = z.object({
  body: z.object({
    email: z.string().email(),
  })
});

// Usage in router via middleware:
router.post('/', validate(AddEmailSchema), emailsController.add);
```

---

## 6. Feature Flags

```typescript
// config/feature-flags.ts
export const Features = {
  ML:              process.env.ENABLE_ML === 'true',
  ASSISTANT:       process.env.ENABLE_ASSISTANT === 'true',
  FOOTPRINT:       process.env.ENABLE_FOOTPRINT === 'true',
  PASSWORD_AUDIT:  process.env.ENABLE_PASSWORD_AUDIT === 'true',
  PUSH:            process.env.ENABLE_PUSH_NOTIFICATIONS === 'true',
} as const;

// Usage in router:
if (!Features.ASSISTANT) return res.status(404).json({ error: { code: 'FEATURE_DISABLED' } });
```

---

## 7. API Design Standards

### Versioning: `/api/v1/...`

### Standard Response Envelope
```json
{ "data": { ... }, "meta": { "page": 1, "total": 71, "pageSize": 20 } }
```

### Standard Error Response
```json
{ "error": { "code": "ACCOUNT_NOT_FOUND", "message": "...", "requestId": "req_abc" } }
```

### Pro Feature Gate (Simple)
```typescript
const requirePro = (req: Request, res: Response, next: NextFunction) => {
  if (req.user.plan !== 'pro') {
    return res.status(403).json({ error: { code: 'PRO_REQUIRED' } });
  }
  next();
};
```

---

## 8. Middleware Stack

```typescript
// app.ts
app.use(requestIdMiddleware);
app.use(structuredLoggingMiddleware);
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(','), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimitMiddleware);
```

---

## 9. Testing Strategy

| Layer | Tool | Target |
|---|---|---|
| Unit | Jest + ts-jest | ≥ 80% on discovery + risk engine |
| Integration | supertest + test MongoDB | All API endpoints |
| Discovery patterns | Fixture email metadata | All pattern types |
| Security | npm audit + eslint-security | CI gate |

---

## What Is NOT in This Architecture

```
❌ Python / FastAPI / Django
❌ PostgreSQL / SQLAlchemy / Alembic
❌ Celery
❌ Microservices / gRPC / API Gateway
❌ Kubernetes
❌ Kafka / RabbitMQ
❌ Elasticsearch
❌ MongoDB as a caching layer (Redis only)
❌ ML model server (until Phase 19)
```

---

## Acceptance Criteria

- [ ] All modules follow Router → Service → Schema structure.
- [ ] All external providers implement their TypeScript interface.
- [ ] Zod validation runs on every POST/PATCH route body.
- [ ] Feature flags correctly return 404/403 for disabled features.
- [ ] All errors return standard `{ error: { code, message, requestId } }` envelope.
- [ ] CORS restricted to configured `ALLOWED_ORIGINS`.
- [ ] `npm audit` passes with zero critical vulnerabilities in CI.
- [ ] Unit test coverage ≥ 80% on discovery pipeline and risk engine.
