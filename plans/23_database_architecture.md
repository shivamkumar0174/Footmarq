# Database Architecture — My_Login (MongoDB + Mongoose)

> MongoDB is the primary datastore. All documents live in MongoDB. Redis is cache + BullMQ broker only. Schemas are defined via Mongoose for runtime validation and type safety.

---

## Design Rules

1. **No collection is created before its phase is being built.**
2. **Redis is not a source of truth.** All persistent data lives in MongoDB.
3. **Mongoose schemas are defined in TypeScript** — strong typing throughout.
4. **Indexes are defined in the schema** — created via `schema.index()`.
5. **No SQL migrations** — MongoDB is schemaless; schema enforcement is at the application layer via Mongoose.
6. **`_id` is MongoDB ObjectId** unless a specific slug or string key makes more sense.

---

## Collections Overview (ERD)

```
users
 ├── userEmails        (userId ref)
 │    ├── emailScans   (userEmailId ref)
 │    └── accounts     (userEmailId ref)
 │         ├── accountEvents  (accountId ref)
 │         ├── securityEvents (accountId ref)
 │         └── breaches       (accountId ref, may be null)
 ├── sessions          (userId ref)
 ├── refreshTokens     (userId ref)
 └── userSettings      (userId ref, 1:1)

services              (global catalog — no user ref)
auditLog              (userId may be null for deleted users)

-- Tier 2+
notifications         (userId ref)
notificationPrefs     (userId ref)
mlCandidates          (Tier 3)
```

---

## ─────────── TIER 1: MVP Collections ───────────

### `users`

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  profilePicture?: string;
  authProvider: 'email' | 'google';
  googleId?: string;
  isVerified: boolean;
  isActive: boolean;
  plan: 'free' | 'pro';
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name:           { type: String, required: true, trim: true },
  email:          { type: String, required: true, unique: true, lowercase: true },
  passwordHash:   { type: String },
  profilePicture: { type: String },
  authProvider:   { type: String, enum: ['email', 'google'], default: 'email' },
  googleId:       { type: String, sparse: true, unique: true },
  isVerified:     { type: Boolean, default: false },
  isActive:       { type: Boolean, default: true },
  plan:           { type: String, enum: ['free', 'pro'], default: 'free' },
  lastLoginAt:    { type: Date },
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ googleId: 1 }, { sparse: true });

export const User = mongoose.model<IUser>('User', UserSchema);
```

### `userEmails`

```typescript
export interface IUserEmail extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
  gmailConnected: boolean;
  gmailAccessToken?: string;     // AES-256-GCM encrypted
  gmailRefreshToken?: string;    // AES-256-GCM encrypted
  gmailTokenExpiresAt?: Date;
  gmailScopes?: string[];
  lastScanAt?: Date;
  scanStatus: 'never_scanned' | 'running' | 'completed' | 'failed' | 'auth_error';
  totalAccountsFound: number;
  autoScanEnabled: boolean;
  scanFrequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  includInBreachCheck: boolean;
}

const UserEmailSchema = new Schema<IUserEmail>({
  userId:              { type: Schema.Types.ObjectId, ref: 'User', required: true },
  email:               { type: String, required: true, lowercase: true },
  isPrimary:           { type: Boolean, default: false },
  isVerified:          { type: Boolean, default: false },
  gmailConnected:      { type: Boolean, default: false },
  gmailAccessToken:    { type: String },
  gmailRefreshToken:   { type: String },
  gmailTokenExpiresAt: { type: Date },
  gmailScopes:         [{ type: String }],
  lastScanAt:          { type: Date },
  scanStatus:          { type: String, default: 'never_scanned' },
  totalAccountsFound:  { type: Number, default: 0 },
  autoScanEnabled:     { type: Boolean, default: true },
  scanFrequency:       { type: String, enum: ['daily','weekly','monthly','manual'], default: 'weekly' },
  includeInBreachCheck: { type: Boolean, default: true },
}, { timestamps: true });

UserEmailSchema.index({ userId: 1 });
UserEmailSchema.index({ userId: 1, email: 1 }, { unique: true });

export const UserEmail = mongoose.model<IUserEmail>('UserEmail', UserEmailSchema);
```

### `services`

```typescript
export interface IService extends Document {
  name: string;
  slug: string;
  primaryDomain: string;
  domains: string[];                // All known domains (includes primaryDomain)
  knownSenderPatterns: string[];
  category: string;
  subcategory?: string;
  logoUrl?: string;
  websiteUrl: string;
  loginUrl?: string;
  accountSettingsUrl?: string;
  securitySettingsUrl?: string;
  deleteAccountUrl?: string;
  dataExportUrl?: string;
  androidDeepLink?: string;
  iosDeepLink?: string;
  androidPackageName?: string;
  iosBundleId?: string;
  supports2FA: boolean;
  twoFATypes?: string[];
  supportsDataExport: boolean;
  isVerified: boolean;             // false = auto-generated candidate
  isActive: boolean;
}

const ServiceSchema = new Schema<IService>({
  name:                  { type: String, required: true },
  slug:                  { type: String, required: true, unique: true },
  primaryDomain:         { type: String, required: true, unique: true },
  domains:               [{ type: String }],   // Indexed for fast lookup
  knownSenderPatterns:   [{ type: String }],
  category:              { type: String, required: true },
  subcategory:           { type: String },
  logoUrl:               { type: String },
  websiteUrl:            { type: String, required: true },
  loginUrl:              { type: String },
  accountSettingsUrl:    { type: String },
  securitySettingsUrl:   { type: String },
  deleteAccountUrl:      { type: String },
  dataExportUrl:         { type: String },
  androidDeepLink:       { type: String },
  iosDeepLink:           { type: String },
  androidPackageName:    { type: String },
  iosBundleId:           { type: String },
  supports2FA:           { type: Boolean, default: false },
  twoFATypes:            [{ type: String }],
  supportsDataExport:    { type: Boolean, default: false },
  isVerified:            { type: Boolean, default: true },
  isActive:              { type: Boolean, default: true },
}, { timestamps: true });

// The most critical index — used on every email scan
ServiceSchema.index({ domains: 1 });
ServiceSchema.index({ slug: 1 }, { unique: true });
ServiceSchema.index({ category: 1 });
// Text search for service discovery
ServiceSchema.index({ name: 'text', primaryDomain: 'text' });

export const Service = mongoose.model<IService>('Service', ServiceSchema);
```

> **Note:** Instead of a separate `service_domains` table, domains are stored as an array on the Service document. A single `domains` array index replaces the entire join table.

### `accounts`

```typescript
export interface IRiskFactor {
  factor: string;
  points: number;
}

export interface IAccount extends Document {
  userEmailId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;        // Denormalized for faster queries
  serviceId?: mongoose.Types.ObjectId;
  customServiceName?: string;
  customServiceDomain?: string;
  confidenceScore: number;               // 0.0 – 1.0
  confidenceLabel: 'confirmed' | 'likely' | 'candidate';
  firstDetectedAt: Date;
  lastActivityAt: Date;
  lastActivitySource?: string;           // LOGIN_ALERT | TRANSACTION | SIGNUP etc.
  lastRiskCalculatedAt: Date;
  activityStatus: 'active' | 'dormant' | 'inactive' | 'deleted';
  eventCount: number;
  riskScore: number;                     // 0–100
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskFactors: IRiskFactor[];
  isBreached: boolean;                   // Derived from breaches collection — not independent truth
  breachedCount: number;
  twoFactorStatus: 'enabled' | 'disabled' | 'unknown' | 'unsupported' | 'catalog_unknown';
  userConfirmed: boolean;
  isArchived: boolean;
  isDeletedByUser: boolean;
  userNote?: string;
  snoozeCleanupUntil?: Date;
}

const AccountSchema = new Schema<IAccount>({
  userEmailId:       { type: Schema.Types.ObjectId, ref: 'UserEmail', required: true },
  userId:            { type: Schema.Types.ObjectId, ref: 'User', required: true },
  serviceId:         { type: Schema.Types.ObjectId, ref: 'Service' },
  customServiceName: { type: String },
  customServiceDomain: { type: String },
  confidenceScore:   { type: Number, default: 1.0 },
  confidenceLabel:   { type: String, enum: ['confirmed','likely','candidate'], default: 'confirmed' },
  firstDetectedAt:   { type: Date, required: true },
  lastActivityAt:    { type: Date, required: true },
  lastActivitySource:{ type: String },
  lastRiskCalculatedAt: { type: Date, default: Date.now },
  activityStatus:    { type: String, default: 'active' },
  eventCount:        { type: Number, default: 1 },
  riskScore:         { type: Number, default: 0 },
  riskLevel:         { type: String, enum: ['low','moderate','high','critical'], default: 'low' },
  riskFactors:       [{ factor: String, points: Number }],
  isBreached:        { type: Boolean, default: false },   // Derived cache
  breachedCount:     { type: Number, default: 0 },
  twoFactorStatus:   { type: String, default: 'catalog_unknown' },
  userConfirmed:     { type: Boolean, default: true },
  isArchived:        { type: Boolean, default: false },
  isDeletedByUser:   { type: Boolean, default: false },
  userNote:          { type: String },
  snoozeCleanupUntil: { type: Date },
}, { timestamps: true });

AccountSchema.index({ userEmailId: 1 });
AccountSchema.index({ userId: 1 });
AccountSchema.index({ userId: 1, serviceId: 1 }, { unique: true, sparse: true });
AccountSchema.index({ userId: 1, riskLevel: 1 });
AccountSchema.index({ userId: 1, activityStatus: 1 });
AccountSchema.index({ userId: 1, isBreached: 1 });
AccountSchema.index({ userId: 1, lastActivityAt: -1 });
// Composite index for dashboard queries
AccountSchema.index({ userId: 1, activityStatus: 1, riskLevel: 1, isBreached: 1 });

export const Account = mongoose.model<IAccount>('Account', AccountSchema);
```

### `accountEvents`

```typescript
export interface IAccountEvent extends Document {
  accountId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;      // Denormalized for faster queries
  messageId: string;                    // Gmail message ID — dedup key
  threadId?: string;
  eventType: string;                    // SIGNUP | TRANSACTION | LOGIN_ALERT etc.
  senderEmail?: string;
  senderName?: string;
  subject?: string;
  eventTimestamp: Date;
  confidenceScore?: number;
  detectionMethod?: string;             // catalog | regex | generic
}

const AccountEventSchema = new Schema<IAccountEvent>({
  accountId:       { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
  messageId:       { type: String, required: true, unique: true },   // DEDUP KEY
  threadId:        { type: String },
  eventType:       { type: String, required: true },
  senderEmail:     { type: String },
  senderName:      { type: String },
  subject:         { type: String },
  eventTimestamp:  { type: Date, required: true },
  confidenceScore: { type: Number },
  detectionMethod: { type: String },
}, { timestamps: true });

AccountEventSchema.index({ messageId: 1 }, { unique: true });  // O(1) dedup check
AccountEventSchema.index({ accountId: 1, eventTimestamp: -1 });
AccountEventSchema.index({ accountId: 1, eventType: 1 });

export const AccountEvent = mongoose.model<IAccountEvent>('AccountEvent', AccountEventSchema);
```

### `breaches`

```typescript
export interface IBreach extends Document {
  userEmailId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId;  // null if domain not in catalog
  hibpBreachName: string;
  breachDomain?: string;
  breachDate?: Date;
  dataClasses?: string[];
  isSensitive: boolean;
  isVerified: boolean;
  isFabricated: boolean;
  isResolved: boolean;
  resolvedAt?: Date;
  firstDetectedAt: Date;
}

const BreachSchema = new Schema<IBreach>({
  userEmailId:    { type: Schema.Types.ObjectId, ref: 'UserEmail', required: true },
  userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountId:      { type: Schema.Types.ObjectId, ref: 'Account' },
  hibpBreachName: { type: String, required: true },
  breachDomain:   { type: String },
  breachDate:     { type: Date },
  dataClasses:    [{ type: String }],
  isSensitive:    { type: Boolean, default: false },
  isVerified:     { type: Boolean, default: true },
  isFabricated:   { type: Boolean, default: false },
  isResolved:     { type: Boolean, default: false },
  resolvedAt:     { type: Date },
  firstDetectedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Idempotency: same breach for same email can't be inserted twice
BreachSchema.index({ userId: 1, hibpBreachName: 1 }, { unique: true });
BreachSchema.index({ userId: 1, isResolved: 1 });
BreachSchema.index({ accountId: 1 });

export const Breach = mongoose.model<IBreach>('Breach', BreachSchema);
```

### `sessions` and `refreshTokens`

```typescript
const SessionSchema = new Schema({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ipAddress:   { type: String },
  userAgent:   { type: String },
  deviceName:  { type: String },
  lastUsedAt:  { type: Date, default: Date.now },
  isRevoked:   { type: Boolean, default: false },
}, { timestamps: true });

SessionSchema.index({ userId: 1, lastUsedAt: -1 });

const RefreshTokenSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  jti:       { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
}, { timestamps: true });

RefreshTokenSchema.index({ jti: 1 }, { unique: true });
```

### `emailScans`

```typescript
const EmailScanSchema = new Schema({
  userEmailId:       { type: Schema.Types.ObjectId, ref: 'UserEmail', required: true },
  userId:            { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status:            { type: String, default: 'running' },
  trigger:           { type: String, default: 'manual' },
  emailsProcessed:   { type: Number, default: 0 },
  accountsFound:     { type: Number, default: 0 },
  accountsUpdated:   { type: Number, default: 0 },
  lastPageToken:     { type: String },    // Checkpoint for crash recovery
  errorMessage:      { type: String },
  startedAt:         { type: Date },
  completedAt:       { type: Date },
}, { timestamps: true });

EmailScanSchema.index({ userEmailId: 1, createdAt: -1 });
```

### `auditLog`

```typescript
const AuditLogSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User' },  // null for deleted users
  action:    { type: String, required: true },
  ipAddress: { type: String },
  metadata:  { type: Schema.Types.Mixed },
}, { timestamps: true });

AuditLogSchema.index({ userId: 1, createdAt: -1 });
```

---

## Breach State Synchronization Rule

> `accounts.isBreached` is a **derived cache** — the `breaches` collection is the source of truth.

```typescript
async function syncAccountBreachState(accountId: string): Promise<void> {
  const unresolvedCount = await Breach.countDocuments({
    accountId,
    isResolved: false
  });

  await Account.findByIdAndUpdate(accountId, {
    isBreached: unresolvedCount > 0,
    breachedCount: unresolvedCount,
    $set: { lastRiskCalculatedAt: new Date() }
  });

  // Cascade: recalculate risk and security score
  const account = await Account.findById(accountId).select('userId');
  if (account) {
    await recalculateAccountRisk(accountId);
    await recalculateSecurityScore(account.userId.toString());
  }
}
```

---

## MongoDB vs PostgreSQL: Key Differences in Practice

| Concept | PostgreSQL | MongoDB (This Project) |
|---|---|---|
| Relationships | Foreign keys + JOINs | `ObjectId` refs + `populate()` |
| Schema | Strict DDL | Mongoose schema (app-level enforcement) |
| Migrations | Alembic | None — add fields as optional |
| Domain lookup | `service_domains` join table | `domains: []` array field + index |
| Risk factors | Separate JSON column | Embedded array in account document |
| Transactions | Native ACID | MongoDB transactions (replica set) |
| Full-text search | tsvector + GIN | MongoDB `$text` index |

---

## ─────────── TIER 2 Collections (Post-MVP) ───────────

Add only when building Phases 12–16:

```
notifications
notificationPrefs
twoFactorEvents
launchEvents
```

---

## ─────────── TIER 3 Collections (Intelligence) ───────────

Add only when building Phases 17–19:

```
mlCandidates
```

---

## Analytics (MongoDB Aggregation — No Separate Store)

```javascript
// Category breakdown
db.accounts.aggregate([
  { $match: { userId: ObjectId(userId), isDeletedByUser: false } },
  { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
  { $unwind: '$service' },
  { $group: { _id: '$service.category', count: { $sum: 1 } } }
]);

// Risk breakdown
db.accounts.aggregate([
  { $match: { userId: ObjectId(userId), isDeletedByUser: false } },
  { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
]);
```

No ClickHouse, BigQuery, or separate analytics DB needed.

---

## Acceptance Criteria

- [ ] All Mongoose schemas are defined with TypeScript interfaces.
- [ ] `messageId` unique index prevents duplicate `accountEvents` on re-scan.
- [ ] `{ userId, hibpBreachName }` compound unique index prevents duplicate breaches.
- [ ] `{ userId, serviceId }` sparse unique index prevents duplicate accounts per service.
- [ ] `domains` array index enables O(log n) domain-to-service lookup during scans.
- [ ] `syncAccountBreachState()` is called on every breach create/resolve — never set `isBreached` directly.
- [ ] All tier 2+ collections are absent from the MVP codebase.
- [ ] Aggregation queries for category/risk breakdown complete in < 200ms for a 500-account user.
