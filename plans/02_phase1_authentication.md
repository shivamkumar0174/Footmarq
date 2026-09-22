# Phase 1 — Authentication

> **Tier 1 MVP.** JWT-based authentication with Google OAuth (for login) and email/password, session management, and 2FA TOTP — all in Node.js + TypeScript.

---

## Goal

Secure user authentication that supports both Google OAuth and email/password login, with JWT access/refresh token rotation and optional TOTP 2FA — forming the security foundation every other phase builds on.

---

## Features

### 1. Authentication Methods

| Method | Flow |
|---|---|
| **Google OAuth** | One-click login via Google — no password |
| **Email + Password** | Register with OTP email verification |

### 2. Google OAuth Login Flow

```
User clicks "Sign in with Google"
              │
              ▼
  GET /api/v1/auth/google
  → Redirect to Google OAuth consent screen
              │
              ▼
  Google calls back: GET /api/v1/auth/google/callback?code=...
              │
              ▼
  Express handler:
    1. Exchange code for Google tokens
    2. Fetch user profile (email, name, picture)
    3. Find or create User document in MongoDB
    4. Create Session document
    5. Issue JWT access token (15min) + refresh token (30 days)
    6. Redirect to frontend with tokens
```

```typescript
// auth/oauth/google.ts
import { OAuth2Client } from 'google-auth-library';

const oauthClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${process.env.API_URL}/api/v1/auth/google/callback`,
});

export async function handleGoogleCallback(code: string, req: Request) {
  const { tokens } = await oauthClient.getToken(code);
  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID!,
  });
  const payload = ticket.getPayload()!;

  // Upsert user
  const user = await User.findOneAndUpdate(
    { googleId: payload.sub },
    {
      name: payload.name,
      email: payload.email,
      profilePicture: payload.picture,
      googleId: payload.sub,
      authProvider: 'google',
      isVerified: true,
    },
    { upsert: true, new: true }
  );

  return createSession(user, req);
}
```

### 3. Email/Password Registration

```typescript
// auth/auth.service.ts
import bcrypt from 'bcrypt';
import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

export async function registerUser(data: z.infer<typeof RegisterSchema>, req: Request) {
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw new AppError('EMAIL_ALREADY_EXISTS', 409);

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash,
    authProvider: 'email',
    isVerified: false,
  });

  // Send OTP email
  await sendVerificationEmail(user);
  return { message: 'Check your email to verify your account.' };
}
```

### 4. JWT Token Pair (Access + Refresh)

```typescript
// shared/utils.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function issueTokenPair(userId: string, sessionId: string) {
  const accessToken = jwt.sign(
    { sub: userId, sessionId, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  const jti = crypto.randomUUID();
  const refreshToken = jwt.sign(
    { sub: userId, sessionId, jti, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken, jti };
}
```

Refresh token stored in MongoDB `refreshTokens` collection. Rotation: every refresh returns a new pair and revokes the old JTI.

### 5. Session Management

```typescript
async function createSession(user: IUser, req: Request) {
  const session = await Session.create({
    userId: user._id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    deviceName: parseDeviceName(req.headers['user-agent']),
  });

  const { accessToken, refreshToken, jti } = issueTokenPair(
    user._id.toString(),
    session._id.toString()
  );

  await RefreshToken.create({
    userId: user._id,
    sessionId: session._id,
    jti,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken, user };
}
```

### 6. Auth Middleware

```typescript
// middleware/auth.middleware.ts
import jwt from 'jsonwebtoken';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED' } });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) throw new Error('User not found');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN' } });
  }
};
```

### 7. TOTP 2FA (Optional, Settings Phase)

```typescript
// Implemented in Phase 15 (Settings) — not Phase 1
// But the schema field is ready: user.twoFaEnabled, user.twoFaSecret
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

async function setup2FA(userId: string) {
  const secret = speakeasy.generateSecret({ name: `My_Login:${user.email}` });
  const qrUrl = await qrcode.toDataURL(secret.otpauth_url!);
  // Store encrypted secret temporarily until user verifies
  return { secret: secret.base32, qrUrl };
}
```

---

## Database Changes

Collections created in this phase:
- `users` (see `23_database_architecture.md`)
- `sessions`
- `refreshTokens`
- `userSettings` (minimal — `{ userId, theme: 'system' }`)

---

## API Endpoints

```
POST /api/v1/auth/register          → { message }
POST /api/v1/auth/verify-email      → { accessToken, refreshToken }  (OTP code)
POST /api/v1/auth/login             → { accessToken, refreshToken, user }
POST /api/v1/auth/refresh           → { accessToken, refreshToken }
POST /api/v1/auth/logout            → { message }
POST /api/v1/auth/forgot-password   → { message }
POST /api/v1/auth/reset-password    → { message }

GET  /api/v1/auth/google            → redirect to Google consent
GET  /api/v1/auth/google/callback   → { accessToken, refreshToken, user }
```

---

## Background Jobs

- OTP + password reset emails dispatched inline (fast — no BullMQ job needed)

---

## Dependencies

- Phase 0 (Foundation) — Express app, MongoDB connection, Redis

---

## What Is Intentionally NOT Implemented

```
❌ Sessions stored in Redis (MongoDB sessions table is source of truth)
❌ TOTP 2FA in Phase 1 (comes in Phase 15 Settings)
❌ OAuth for providers other than Google (add via OAuthProvider interface)
❌ Magic link login (add later if needed)
❌ Social auth (GitHub, Apple ID) — add via same passport.js strategy pattern
❌ Rate limiting per-user login attempts (handled by global rate limiter in Phase 0)
```

---

## Cost / Complexity Considerations

- `jsonwebtoken` + `bcrypt` + `google-auth-library` — all well-maintained Node.js packages, zero extra services.
- JWT verification is local (no Redis round-trip per request) — keeps auth fast.
- `speakeasy` TOTP library works offline — no external TOTP service needed.
- The `GmailProvider` OAuth flow (Phase 3) is a **separate OAuth scope** from login — handled in its own module to keep concerns clean.

---

## Acceptance Criteria

- [ ] Email/password registration creates a user, sends OTP, and requires verification before login.
- [ ] Google OAuth login creates/updates user on first sign-in and issues tokens.
- [ ] Access token expires in 15 minutes; refresh token expires in 30 days.
- [ ] Refresh token rotation: new pair issued and old JTI revoked on each `/refresh` call.
- [ ] `authenticate` middleware correctly rejects expired, malformed, and revoked tokens.
- [ ] Logout revokes the session and all associated refresh tokens.
- [ ] Forgot password sends a time-limited (1 hour) reset link.
- [ ] All auth endpoints return consistent `{ error: { code, message } }` on failure.
- [ ] Passwords are bcrypt-hashed with cost factor 12 — never stored plaintext.
