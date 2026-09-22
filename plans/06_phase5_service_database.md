# Phase 5 — Service Catalog

> The intelligence layer for account discovery. Curated, expandable, and maintained incrementally — not front-loaded with thousands of records.

---

## Goal

Build and maintain a curated service catalog of ~100–200 high-value services that powers the discovery engine, and implement an automatic expansion flow for unknown senders.

---

## Features

### 1. Initial Catalog Scope (100–200 Services)

Start with the highest-value services across key categories. Don't attempt to manually catalog thousands of services before launch.

**Priority seeding order:**

| Category | Examples | Why High Priority |
|---|---|---|
| **Email Providers** | Google, Microsoft, Apple, Yahoo | Used for auth — baseline |
| **Developer** | GitHub, GitLab, AWS, Vercel, Netlify, DigitalOcean, Heroku | High-value targets, 2FA-sensitive |
| **Finance** | PayPal, Stripe, Wise, Revolut, Coinbase, bank services | Breach + 2FA critical |
| **Social** | Instagram, Facebook, Twitter/X, LinkedIn, Reddit, TikTok | Large user overlap |
| **Streaming** | Netflix, Spotify, YouTube, Apple TV+, Disney+ | Near-universal |
| **Shopping** | Amazon, eBay, Etsy, Shopify | Very common |
| **Cloud Storage** | Dropbox, Google Drive, iCloud, OneDrive | Privacy-sensitive |
| **Gaming** | Steam, PlayStation Network, Xbox, Epic, Battle.net | Breach history |
| **Productivity** | Notion, Slack, Zoom, Figma, Trello, Atlassian | Growing user base |
| **Healthcare** | HealthKart, major healthcare portals | HIPAA-sensitive |
| **Education** | Coursera, edX, Udemy, Khan Academy | Common signups |
| **Travel** | Booking.com, Airbnb, Expedia | Dormant accounts common |

### 2. Service Record Schema

```sql
CREATE TABLE services (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(100) NOT NULL,
  slug                  VARCHAR(100) UNIQUE NOT NULL,
  primary_domain        VARCHAR(255) NOT NULL UNIQUE,
  known_sender_patterns TEXT[],      -- e.g. {"no-reply@github.com", "noreply@github.com"}
  category              VARCHAR(50) NOT NULL,
  subcategory           VARCHAR(50),
  logo_url              TEXT,
  website_url           TEXT NOT NULL,
  login_url             TEXT,
  account_settings_url  TEXT,
  security_settings_url TEXT,
  delete_account_url    TEXT,
  data_export_url       TEXT,
  android_deep_link     TEXT,
  ios_deep_link         TEXT,
  android_package_name  VARCHAR(255),
  ios_bundle_id         VARCHAR(255),
  supports_2fa          BOOLEAN DEFAULT false,
  two_fa_types          TEXT[],      -- ["totp", "sms", "hardware_key", "passkey"]
  supports_data_export  BOOLEAN DEFAULT false,
  is_verified           BOOLEAN DEFAULT true,  -- false = auto-generated candidate
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE service_domains (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  domain     VARCHAR(255) NOT NULL UNIQUE,  -- Lookup key — must be unique across all services
  is_primary BOOLEAN DEFAULT false
);
CREATE UNIQUE INDEX idx_service_domains_domain ON service_domains(domain);
```

### 3. Unknown Service → Candidate Flow

When the discovery engine encounters a sender domain not in `service_domains`:

```
Unknown domain (e.g. "announcements.someapp.io")
              │
              ▼
  Auto-extract root domain: "someapp.io"
              │
              ▼
  Create service candidate (is_verified = false):
    - name: "someapp" (auto from domain)
    - primary_domain: "someapp.io"
    - is_verified: false
    - category: "Other"
              │
              ▼
  Create account with confidence_label = 'candidate'
  (visible in dashboard with "Needs review" badge)
              │
              ▼
  Future: admin review page or automated categorization
  (Tier 3 — ML category classification)
```

This means **no email evidence is discarded**. Unknown services become candidates that grow the catalog over time with real-world data.

### 4. Sender Pattern Matching

Each service stores known sender email patterns:

```python
# Example: GitHub service record
{
  "name": "GitHub",
  "primary_domain": "github.com",
  "known_sender_patterns": [
    "noreply@github.com",
    "notifications@github.com",
    "support@github.com"
  ]
}
```

Pattern priority in discovery:
1. Exact sender email match → highest confidence
2. Sender domain matches `service_domains` → high confidence
3. Subject pattern regex matches → medium confidence
4. Root domain extraction → candidate confidence

### 5. Category Taxonomy

```python
CATEGORIES = [
    "Social",
    "Finance",
    "Developer",
    "Shopping",
    "Streaming",
    "Gaming",
    "Cloud / Storage",
    "Productivity",
    "Healthcare",
    "Education",
    "Travel",
    "News / Media",
    "Utilities",
    "Email",
    "Other",
]
```

### 6. Service Logo CDN Strategy

- Store logo URLs pointing to **Clearbit Logo API**: `https://logo.clearbit.com/{domain}`
- Falls back to a generated letter-avatar (first letter of service name) if Clearbit returns 404.
- No logo hosting required in MVP.

### 7. Cache Strategy

```python
# Redis cache: service catalog (1-hour TTL)
# Reason: catalog changes infrequently; cache dramatically reduces DB reads during scans

CACHE_KEY = "service_catalog_v1"
CACHE_TTL_SECONDS = 3600

async def get_service_catalog() -> list[Service]:
    cached = await redis.get(CACHE_KEY)
    if cached:
        return json.loads(cached)
    services = await db.query(Service).where(Service.is_active == true()).all()
    await redis.set(CACHE_KEY, json.dumps(services), ex=CACHE_TTL_SECONDS)
    return services
```

---

## Database Changes

See schemas above (`services`, `service_domains`).

---

## API Changes

```
GET /api/v1/services                 → paginated catalog (public, no auth)
GET /api/v1/services/{slug}          → service detail
GET /api/v1/services/search?q=       → search by name or domain
GET /api/v1/services/categories      → list all category names

# Admin-only (not public in MVP)
POST /api/v1/admin/services                   → add new service
PATCH /api/v1/admin/services/{id}             → update service
PATCH /api/v1/admin/services/{id}/verify      → verify a candidate service
```

---

## Background Jobs

None. Service catalog is read-heavy; writes happen via admin interface and the candidate auto-generation in the discovery pipeline.

---

## Dependencies

- Phase 4 (Account Discovery) — catalog is queried during every scan

---

## What Is Intentionally NOT Implemented

```
❌ Automated seeding of 1,000+ services before launch
❌ Web scraping for automatic service discovery
❌ ML-based automatic categorization (Tier 3)
❌ User-submitted service additions in MVP (admin only)
❌ Logo hosting / logo processing pipeline (use Clearbit CDN)
❌ Service merge/dedup tooling (admin can do this manually)
```

---

## Cost / Complexity Considerations

- Starting with 100–200 services instead of 1,000+ saves weeks of manual data entry.
- Clearbit CDN costs nothing for reasonable request volumes.
- The candidate flow ensures unknown services are captured as data even before the catalog grows — making this a self-improving system over time.
- Redis caching the catalog reduces DB reads by ~99% during active scans.

---

## Acceptance Criteria

- [ ] 100+ service records are seeded via `services.json` before launch.
- [ ] `service_domains` lookup correctly resolves senders to service IDs.
- [ ] Unknown sender domains create unverified candidate services in the catalog.
- [ ] Candidate accounts are shown with `confidence_label = 'candidate'` and "Needs review" badge.
- [ ] Service catalog is cached in Redis with 1-hour TTL.
- [ ] Cache is invalidated when any service record is created or updated.
- [ ] Clearbit logo URL is used; fallback to letter-avatar renders correctly.
- [ ] Admin can verify/update candidate services via admin endpoints.
