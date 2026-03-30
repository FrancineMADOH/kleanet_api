# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository overview

This repo contains two things:

1. **`bw_kleanet/`** — Odoo 19 module (Python) — the back-office for the Kleanet laundry service
2. **`src/`** — Fastify/TypeScript API (in active development — see progress below)

`API_DEV_PLAN.md` is the authoritative spec — follow it step by step, never skipping a step.

---

## Odoo module — `bw_kleanet`

**Stack**: Odoo 19.0, Python, QWeb, SCSS, vanilla JS

### Models (11)
| Model | File |
|-------|------|
| `laundry.order` | `models/laundry_order.py` |
| `laundry.order.line` | `models/laundry_order_line.py` |
| `laundry.material` | `models/laundry_material.py` |
| `laundry.garment.type` | `models/laundry_garment_type.py` |
| `laundry.pricing.rule` | `models/laundry_pricing_rule.py` |
| `laundry.subscription` | `models/laundry_subscription.py` |
| `laundry.subscription.plan` | `models/laundry_subscription_plan.py` |
| `laundry.appointment` | `models/laundry_appointment.py` |
| `laundry.feedback` | `models/laundry_feedback.py` |
| `laundry.faq` + `laundry.faq.category` | `models/laundry_faq.py` |

### Order states
`draft` → `received` → `in_progress` → `ready` → `delivered` / `cancelled`

### Key conventions
- All internal refs use prefix `bw_kleanet.` (e.g. `bw_kleanet.group_laundry_user`)
- Sequences: `KLA/%(year)s/%(seq)05d` (orders), `SUB/...`, `APT/...`, `FBK/...`, `FAQ/...`
- Security groups: `bw_kleanet.group_laundry_user` and `bw_kleanet.group_laundry_manager`
- Views: use `<list>` only — never `<tree>` (removed in Odoo 18+)
- `view_mode` must be `"list,form"` not `"tree,form"`
- Python: modern API only (`@api.model`, `@api.depends`, etc.)
- Appointment quota is informational only — no hard blocking

### Website controllers (5 public pages)
- `controllers/landing_page.py` — landing page
- `controllers/order_status.py` — order tracking
- `controllers/feedback.py` — customer feedback form
- `controllers/subscription.py` — subscription wizard
- `controllers/faqs.py` — FAQ page

### Installing the module
```bash
./odoo-bin -d <db_name> -i bw_kleanet --dev=all
./odoo-bin -d <db_name> -u bw_kleanet --dev=all
```

---

## Fastify API — `src/`

**Stack**: Node.js 20 + Fastify 5 + TypeScript + Zod + Vitest + ioredis + Swagger/OpenAPI

### Dev commands
```bash
npm run dev      # tsx watch src/server.ts
npm run build    # tsc
npm test         # vitest run --passWithNoTests
```

### Infrastructure (Docker)
```bash
docker compose up redis -d   # Redis on localhost:6379
# Odoo runs natively on localhost:8069
```

### Steps completed
| Step | Status | What was built |
|------|--------|---------------|
| FOUNDATION-01 | ✅ | Project scaffold, tsconfig, package.json |
| FOUNDATION-02 | ✅ | Swagger UI at `/docs`, `@fastify/swagger` plugin |
| FOUNDATION-03 | ✅ | Zod env validation, `src/config/env.ts`, `src/config/constants.ts` |
| FOUNDATION-04 | ✅ | Odoo JSON-RPC client (`OdooSession` + `OdooClient` + Fastify plugin) |
| FOUNDATION-05 | ✅ | JWT plugin (`@fastify/jwt`), `authGuard` preHandler, `JwtPayload` type |
| AUTH-01 | ✅ | Redis plugin (ioredis), OTP service (generate/store/verify), SMS service (Mock + AfricasTalking) |
| AUTH-02 | ✅ | `POST /api/v1/auth/phone/send` + `POST /api/v1/auth/phone/verify` — full OTP→JWT cycle |

### Next step
**AUTH-03** — Google OAuth (`POST /api/v1/auth/google`)

### Key files
```
src/
├── app.ts                          # Fastify instance factory — registers all plugins + routes
├── server.ts                       # Entry point — listens on config.PORT
├── config/
│   ├── env.ts                      # Zod env schema + Config type
│   └── constants.ts                # OTP_TTL_SECONDS, OTP_MAX_ATTEMPTS, REDIS_PREFIX_*, etc.
├── plugins/
│   ├── swagger.ts                  # Swagger UI at /docs
│   ├── jwt.ts                      # @fastify/jwt with JWT_SECRET + JWT_EXPIRY
│   └── redis.ts                    # ioredis — fails fast if Redis unreachable at startup
├── shared/
│   ├── odoo/
│   │   ├── odoo-client.ts          # OdooClient class + fastify.odoo decorator
│   │   ├── odoo-session.ts         # Session cookie management (lazy auth, auto-reconnect)
│   │   └── odoo.types.ts           # JSON-RPC types + OdooClientError/NetworkError/SessionError
│   ├── guards/
│   │   └── auth.guard.ts           # authGuard preHandler — verifies Bearer JWT → request.user
│   └── otp/
│       ├── otp.service.ts          # generateOtp, storeOtp, verifyOtp (Redis-backed)
│       └── sms.service.ts          # SmsProvider interface, MockSmsProvider, AfricasTalkingSmsProvider
├── modules/
│   └── auth/
│       ├── auth.types.ts           # SendOtpInput, VerifyOtpInput, LoginResponse, SendOtpResult
│       ├── auth.schema.ts          # Fastify/Swagger JSON schemas for auth routes
│       ├── auth.service.ts         # sendOtp(), verifyOtpAndLogin() — business logic
│       └── auth.routes.ts          # POST /phone/send, POST /phone/verify
└── types/
    └── fastify.d.ts                # JwtPayload type + FastifyRequest.user augmentation
```

### Critical pitfalls (learned the hard way)
- **Odoo always returns HTTP 200** — check `body.error` field, never HTTP status
- **Odoo `session_id` is in `Set-Cookie` header**, not the JSON body — extract with `response.headers.get('set-cookie')`
- **`res.partner` has no `mobile` field** on this Odoo instance — search by `phone` only
- **Routes plugins must NOT use `fp()` (fastify-plugin)** — `fp` disables scope isolation and the `prefix` option is ignored; only decorator plugins (redis, jwt, odoo) use `fp`

### Environment variables
```
PORT=3000
NODE_ENV=development
ODOO_URL=http://localhost:8068
ODOO_DB=odoo
ODOO_USER=admin
ODOO_PASSWORD=admin
JWT_SECRET=<min 32 chars>
JWT_EXPIRY=30m
REFRESH_EXPIRY=30d
REDIS_URL=redis://localhost:6379
AFRICASTALKING_API_KEY=        # optional in dev
AFRICASTALKING_USERNAME=       # optional in dev
GOOGLE_CLIENT_ID=              # required for AUTH-03
FACEBOOK_APP_ID=               # required for AUTH-04
FACEBOOK_APP_SECRET=           # required for AUTH-04
```

---

## Project context

Service: home laundry pickup/delivery in Yaoundé, Cameroon.
Payment: Phase 0 = cash/MoMo on delivery; Phase 1 = Campay (MTN + Orange) via WebView.
SMS: Africa's Talking (+237 Cameroon).
GPS: `res.partner.partner_latitude/longitude` (native Odoo fields).
V2 models (batches, bags, machines, consumables, incidents) excluded — future `franny_laundry_v2` module.
