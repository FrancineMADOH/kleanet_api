# Kleanet API

Fastify/TypeScript middleware API for the Kleanet laundry service.
Sits between the Flutter mobile app and the Odoo 19 back-office.

---

## Stack

- **Runtime**: Node.js 20 + Fastify 5 + TypeScript
- **Auth**: JWT (access 30 min / refresh 30 days) + OTP SMS via Africa's Talking
- **Cache**: Redis (ioredis) — catalogue + FAQ cached 1 hour
- **Back-office**: Odoo 19 via JSON-RPC (one service account)
- **Docs**: Swagger UI at `/docs`

---

## Prerequisites

- Node.js >= 20
- Docker (for Redis) — or a local Redis instance on port 6379
- Odoo 19 running on port 8069 with the `bw_kleanet` module installed

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env

# 3. Start Redis
docker compose up redis -d

# 4. Start the API in dev mode (hot reload)
npm run dev
```

Server starts at `http://localhost:3000`.
Swagger UI: `http://localhost:3000/docs`

---

## Environment variables

Copy `.env.example` to `.env` and fill in the required values.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default: 3000) | HTTP port |
| `NODE_ENV` | No (default: development) | `development` \| `production` \| `test` |
| `ODOO_URL` | **Yes** | Odoo base URL (e.g. `http://localhost:8069`) |
| `ODOO_DB` | **Yes** | Odoo database name |
| `ODOO_USER` | **Yes** | Odoo service account login |
| `ODOO_PASSWORD` | **Yes** | Odoo service account password |
| `JWT_SECRET` | **Yes** | Min 32 characters — used to sign/verify JWT tokens |
| `JWT_EXPIRY` | No (default: 30m) | Access token expiry |
| `REFRESH_EXPIRY` | No (default: 30d) | Refresh token expiry |
| `REDIS_URL` | **Yes** | Redis connection URL (e.g. `redis://localhost:6379`) |
| `AFRICASTALKING_API_KEY` | No | Africa's Talking API key (OTP SMS in production) |
| `AFRICASTALKING_USERNAME` | No | Africa's Talking username |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `FACEBOOK_APP_ID` | No | Facebook app ID |
| `FACEBOOK_APP_SECRET` | No | Facebook app secret |

> In `development`, SMS codes are printed to the console (MockSmsProvider) — no real SMS sent.
> Google/Facebook OAuth routes return `401` if the corresponding env vars are absent.

---

## Commands

```bash
npm run dev             # Start with hot reload (tsx watch)
npm run build           # Compile TypeScript → dist/
npm start               # Run compiled build (production)
npm test                # Run test suite (Vitest, 50 tests)
npm run test:watch      # Run tests in watch mode
npm run export:openapi  # Export OpenAPI schema → docs/openapi.json
```

---

## How to get a JWT for Swagger UI

1. Open `http://localhost:3000/docs`
2. Call **POST /api/v1/auth/phone/send** with `{ "phone": "+237612345678" }`
3. The OTP code is printed in the **terminal** (dev mode — no real SMS)
4. Call **POST /api/v1/auth/phone/verify** with `{ "phone": "...", "code": "..." }`
5. Copy the `access_token` from the response
6. In Swagger UI: click **Authorize** (top right) → paste the token → **Authorize**

All protected routes (lock icon) will now include the `Bearer` header automatically.

---

## API overview

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/v1/auth/phone/send` | — | Send OTP to phone |
| POST | `/api/v1/auth/phone/verify` | — | Verify OTP → JWT tokens |
| POST | `/api/v1/auth/google` | — | Google OAuth login |
| POST | `/api/v1/auth/facebook` | — | Facebook OAuth login |
| POST | `/api/v1/auth/refresh` | — | Refresh access token |
| POST | `/api/v1/auth/logout` | JWT | Revoke refresh token |
| GET | `/api/v1/catalog/services` | — | Garment types + pricing rules |
| GET | `/api/v1/catalog/plans` | — | Subscription plans |
| DELETE | `/api/v1/catalog/cache` | JWT | Invalidate catalog + FAQ cache |
| POST | `/api/v1/orders` | JWT | Create laundry order |
| GET | `/api/v1/orders` | JWT | List my orders (paginated) |
| GET | `/api/v1/orders/:id` | JWT | Order detail |
| POST | `/api/v1/appointments` | JWT | Book a pickup appointment |
| GET | `/api/v1/appointments` | JWT | List my appointments |
| GET | `/api/v1/subscription` | JWT | My active subscription |
| POST | `/api/v1/subscription` | JWT | Subscribe to a plan |
| GET | `/api/v1/profile` | JWT | My profile |
| PATCH | `/api/v1/profile` | JWT | Update name / email |
| PATCH | `/api/v1/profile/location` | JWT | Save GPS coordinates |
| POST | `/api/v1/feedback` | JWT | Submit order feedback |
| GET | `/api/v1/faq` | — | FAQ list (filterable by category) |
| GET | `/ping` | — | Health check |

---

## Export OpenAPI schema

```bash
npm run export:openapi
# → writes docs/openapi.json

# Validate (optional):
npx @apidevtools/swagger-cli validate docs/openapi.json

# Generate Dart/Flutter client (optional):
openapi-generator-cli generate \
  -i docs/openapi.json \
  -g dart \
  -o ../kleanet_flutter/lib/api
```

---

## Security

- **Helmet** (`@fastify/helmet`) — sets `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, and other security headers on every response.
- **Rate limiting** (`@fastify/rate-limit`) — 5 requests/minute per IP on `POST /auth/phone/send` (HTTP layer), plus a per-phone soft limit in Redis (3 per 10 minutes, service layer).
- **JWT guard** — all `/api/v1/*` routes except auth, catalog, FAQ, and `/ping` require a valid Bearer token.
- **Partner isolation** — every Odoo query includes `partner_id = <authenticated user>` in the domain; a user can never read another user's orders, appointments, or profile.

---

## Odoo setup

The API uses a single service account to talk to Odoo (never individual user accounts).
That account must belong to the `Laundry Manager` group in Odoo.

**Dev (quick):** Settings → Users → `admin` → add **Laundry Manager** role.

**Prod (recommended):** Create a dedicated `kleanet_api` user, assign **Laundry Manager**, set its credentials in `.env`.
