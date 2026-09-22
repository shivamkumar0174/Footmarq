# Background Processing — My_Login (BullMQ + Node.js)

> Asynchronous job processing using BullMQ backed by Redis. Same language (TypeScript) as the rest of the application — no Celery, no Python.

---

## 1. The Rule: What Belongs in a Background Job

> If an operation completes in < ~2 seconds and has no external long-running I/O, execute it synchronously in the HTTP request cycle.

### Background (BullMQ):
```
Gmail scanning          (2–10 minutes per full mailbox)
HIBP breach checks      (external API, rate-limited)
Weekly scan fan-out     (queue jobs for all auto-scan emails)
Batch risk recalculation (many accounts at once)
Data export generation  (ZIP file creation)
Retention cleanup       (daily purge of expired data)
Weekly digest emails    (fan-out to all subscribed users)
```

### Synchronous (HTTP request):
```
Get account detail
Search/filter accounts
Mark notification read
Archive a single account
Update settings
Mark breach resolved    (sync the account state, then return)
```

---

## 2. MVP Queue Architecture (3 Queues)

```
Express API Server
       │
       ▼ (queue.add())
    Redis Broker
       │
       ├── Queue: gmail        → GmailWorker (2–3 concurrent)
       │
       ├── Queue: breach       → BreachWorker (1–2 concurrent)
       │
       └── Queue: maintenance  → MaintenanceWorker (1 concurrent)
```

**Do NOT add in MVP:**
- `notifications` queue (dispatch email synchronously for critical; batch in maintenance)
- `risk` queue (run risk recalc inline after breach/scan changes; batch in maintenance)
- `ml` queue (no ML in MVP)

---

## 3. Technology

| Component | Tool | Notes |
|---|---|---|
| Job queue | BullMQ 5.x | Redis-backed, TypeScript-native |
| Queue broker | Redis | ioredis connection |
| Result / state | Redis (BullMQ built-in) | Job progress, status |
| Scheduler | BullMQ `cron` repeat | Replaces Celery Beat |
| Worker process | Node.js process (`worker.ts`) | Can be same process as API in dev |
| Monitoring | Bull Board (web UI) | Admin-only at `/admin/queues` |

---

## 4. Queue Setup

```typescript
// jobs/queues.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const gmailQueue = new Queue('gmail', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,   // Keep last 100 completed jobs
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  },
});

export const breachQueue = new Queue('breach', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: 'exponential', delay: 300_000 },
  },
});

export const maintenanceQueue = new Queue('maintenance', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 2,
  },
});

// Job type definitions
export type GmailJobData = { userEmailId: string; scanId: string };
export type BreachJobData = { userEmailId: string };
export type MaintenanceJobData = { type: 'batch_risk' | 'purge_data' | 'weekly_digest' | 'generate_export'; payload?: Record<string, unknown> };
```

---

## 5. Core Worker Definitions

### 5.1 — Gmail Worker

```typescript
// jobs/gmail.worker.ts
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { scanGmailInbox } from '../modules/gmail/gmail.scanner';
import { updateScanStatus } from '../modules/emails/emails.service';
import { createSystemNotification } from '../modules/notifications/notifications.service';
import type { GmailJobData } from './queues';

const gmailWorker = new Worker<GmailJobData>(
  'gmail',
  async (job: Job<GmailJobData>) => {
    const { userEmailId, scanId } = job.data;
    try {
      // Updates progress every 500 messages for crash recovery
      await scanGmailInbox(userEmailId, scanId, (progress) => {
        job.updateProgress(progress);
      });
    } catch (err: unknown) {
      if (isGoogleAuthError(err)) {
        // Token refresh failed — don't retry; need user action
        await updateScanStatus(scanId, 'auth_error');
        await createSystemNotification(userEmailId, 'gmail_reconnect_required');
        return; // Don't throw — no point in retrying an auth error
      }
      if (isRateLimitError(err)) {
        // Will be retried with exponential backoff
        throw err;
      }
      await updateScanStatus(scanId, 'failed', (err as Error).message);
      throw err;
    }
  },
  { connection: redisConnection, concurrency: 2 }
);

gmailWorker.on('failed', (job, err) => {
  console.error(`Gmail job ${job?.id} failed: ${err.message}`);
});
```

### 5.2 — Breach Worker

```typescript
// jobs/breach.worker.ts
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { HIBPBreachProvider } from '../modules/breaches/providers/hibp.provider';
import { processBreachResults } from '../modules/breaches/breaches.service';
import { recalculateSecurityScore } from '../modules/security/security.score';
import type { BreachJobData } from './queues';

const breachProvider = new HIBPBreachProvider();

const breachWorker = new Worker<BreachJobData>(
  'breach',
  async (job: Job<BreachJobData>) => {
    const { userEmailId } = job.data;

    // Rate-limit: 10 calls per minute per HIBP guidelines
    const records = await breachProvider.checkEmail(userEmailId);
    const newBreaches = await processBreachResults(userEmailId, records);

    if (newBreaches.length > 0) {
      // Inline — fast operations, don't need a separate queue job
      for (const breach of newBreaches) {
        if (breach.accountId) await syncAccountBreachState(breach.accountId);
      }
      const email = await UserEmail.findById(userEmailId);
      if (email) await recalculateSecurityScore(email.userId.toString());
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    limiter: { max: 10, duration: 60_000 }  // 10 jobs per minute (HIBP rate limit)
  }
);
```

### 5.3 — Maintenance Worker

```typescript
// jobs/maintenance.worker.ts
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import type { MaintenanceJobData } from './queues';

const maintenanceWorker = new Worker<MaintenanceJobData>(
  'maintenance',
  async (job: Job<MaintenanceJobData>) => {
    switch (job.data.type) {
      case 'batch_risk':
        await batchRecalculateRiskScores();
        break;
      case 'purge_data':
        await purgeExpiredData();
        break;
      case 'weekly_digest':
        await sendWeeklyDigestToAllUsers();
        break;
      case 'generate_export':
        await generateUserExport(job.data.payload!.userId as string, job.data.payload!.exportId as string);
        break;
      default:
        throw new Error(`Unknown maintenance job type: ${job.data.type}`);
    }
  },
  { connection: redisConnection, concurrency: 1 }
);
```

---

## 6. Scheduled (Recurring) Jobs — BullMQ `cron`

```typescript
// jobs/scheduler.ts
import { gmailQueue, breachQueue, maintenanceQueue } from './queues';

export async function startScheduler() {
  // Weekly Gmail scan fan-out — Monday 00:00 UTC
  await gmailQueue.add(
    'weekly-scan-fanout',
    { type: 'fanout' } as any,
    { repeat: { pattern: '0 0 * * 1' } }  // cron: Monday 00:00
  );

  // Weekly breach check fan-out — Monday 01:00 UTC
  await breachQueue.add(
    'weekly-breach-fanout',
    { type: 'fanout' } as any,
    { repeat: { pattern: '0 1 * * 1' } }
  );

  // Daily risk batch — 02:00 UTC
  await maintenanceQueue.add(
    'daily-risk-batch',
    { type: 'batch_risk' },
    { repeat: { pattern: '0 2 * * *' } }
  );

  // Weekly digest emails — Monday 08:00 UTC
  await maintenanceQueue.add(
    'weekly-digest',
    { type: 'weekly_digest' },
    { repeat: { pattern: '0 8 * * 1' } }
  );

  // Daily retention cleanup — 03:00 UTC
  await maintenanceQueue.add(
    'daily-cleanup',
    { type: 'purge_data' },
    { repeat: { pattern: '0 3 * * *' } }
  );
}
```

---

## 7. Idempotency Requirements

| Job | Idempotency Mechanism |
|---|---|
| Gmail scan | `messageId` unique index — duplicate `accountEvents` inserts are rejected |
| Breach check | `{ userId, hibpBreachName }` unique index — upsert or skip |
| Risk recalculation | Always overwrites `riskScore` + `riskFactors` — idempotent by nature |
| Data export | `exportId` tracks state; re-run regenerates and overwrites link |
| Retention cleanup | Idempotent by definition (delete where condition) |

---

## 8. Redis Failure Handling

When Redis is unavailable:
- BullMQ jobs cannot be queued (background scans degrade)
- Redis cache misses fall back to direct MongoDB queries
- Rate limiting fails open (requests proceed)
- Auth (JWT verification) continues — tokens are validated locally, not from Redis

Core account dashboard reads continue to work — they query MongoDB directly.

---

## 9. Docker Compose Deployment (MVP)

```yaml
services:
  api:
    build: ./backend
    command: node dist/server.js
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=${REDIS_URL}
    depends_on: [mongodb, redis]

  worker:
    build: ./backend
    command: node dist/jobs/worker-runner.js    # Starts gmail + breach + maintenance workers
    restart: always
    depends_on: [mongodb, redis]

  scheduler:
    build: ./backend
    command: node dist/jobs/scheduler.js        # Adds recurring BullMQ jobs
    restart: always
    depends_on: [mongodb, redis]

  bullboard:
    build: ./backend
    command: node dist/jobs/bullboard.js        # Admin queue monitor
    ports: ["3001:3001"]
    # Restrict to admin network

  mongodb:
    image: mongo:7
    volumes: [mongodb_data:/data/db]

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

  nginx:
    image: nginx:alpine
    volumes: [./nginx.conf:/etc/nginx/nginx.conf]
    ports: ["80:80", "443:443"]
```

---

## What Is NOT Implemented in MVP

```
❌ Python / Celery (BullMQ is the only job queue)
❌ Separate notifications worker (dispatch inline for critical emails)
❌ Separate risk_calc worker (runs in maintenance queue)
❌ ML worker (no ML in MVP)
❌ Hourly HIBP polling (weekly sweep only)
❌ Kafka / RabbitMQ
❌ Push notifications via FCM/APNs
```

---

## Acceptance Criteria

- [ ] BullMQ workers start successfully and process jobs from all 3 queues.
- [ ] Gmail scan job checkpoints progress via `job.updateProgress()` every 500 messages.
- [ ] Gmail auth errors do NOT retry — they create a system notification for the user.
- [ ] Rate limiter on breach queue: max 10 jobs/minute (HIBP limit compliance).
- [ ] Running a breach check twice produces no duplicate `breaches` documents (unique index catches it).
- [ ] Running a Gmail scan twice produces no duplicate `accountEvents` (messageId unique index).
- [ ] All 5 recurring cron jobs are registered on scheduler startup.
- [ ] Bull Board accessible at port 3001 (admin-only) showing queue depths and job status.
- [ ] Worker containers restart automatically on crash (`restart: always`).
- [ ] Dashboard remains accessible (MongoDB direct reads) when Redis is temporarily down.
