# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository overview

This repo contains two things:

1. **`bw_kleanet/`** — Odoo 19 module (Python) — the back-office for the Kleanet laundry service
2. **`API_DEV_PLAN.md`** — Full functional spec for the Fastify/TypeScript API (not yet scaffolded)

The Fastify API (`franny-api/`) does not exist yet. `API_DEV_PLAN.md` is the authoritative spec — follow it step by step, never skipping a step.

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
(No washing/drying states — these were removed vs. the original franny_laundry module.)

### Key conventions
- All internal refs use prefix `bw_kleanet.` (e.g. `bw_kleanet.group_laundry_user`)
- Sequences: `KLA/%(year)s/%(seq)05d` (orders), `SUB/...`, `APT/...`, `FBK/...`, `FAQ/...`
- Security groups: `bw_kleanet.group_laundry_user` and `bw_kleanet.group_laundry_manager`
- Views: use `<list>` only — never `<tree>` (removed in Odoo 18+)
- `view_mode` must be `"list,form"` not `"tree,form"`
- Python: modern API only (`@api.model`, `@api.depends`, etc.)
- Appointment quota is informational only — no hard blocking (`_check_weekly_quota_hard` was removed)

### Website controllers (5 public pages)
- `controllers/landing_page.py` — landing page
- `controllers/order_status.py` — order tracking
- `controllers/feedback.py` — customer feedback form
- `controllers/subscription.py` — subscription wizard
- `controllers/faqs.py` — FAQ page

### Installing the module
```bash
# From Odoo root
./odoo-bin -d <db_name> -i bw_kleanet --dev=all
# Upgrade
./odoo-bin -d <db_name> -u bw_kleanet --dev=all
```

---

## Fastify API — not yet scaffolded

The API must be built following `API_DEV_PLAN.md` in order. The spec is organized into 10 sections:

1. **FOUNDATION** — TypeScript project init, Swagger UI, env validation (Zod), Odoo JSON-RPC client
2. **AUTH** — OTP SMS (Africa's Talking), Google OAuth, Facebook OAuth, JWT + Redis refresh tokens
3. **CATALOG** — garment types, materials, pricing rules (read-only, cached in Redis)
4. **ORDERS** — CRUD for `laundry.order`, order tracking endpoint
5. **APPOINTMENTS** — pickup scheduling
6. **SUBSCRIPTION** — plan listing, subscription management
7. **PROFILE** — customer profile + GPS location save
8. **FEEDBACK** — submit feedback
9. **FAQ** — list FAQs
10. **QUALITY** — tests and finalization

**Planned stack**: Node.js + Fastify + TypeScript + Zod + Vitest + Redis + Swagger/OpenAPI

**Key environment variables** (see `API_DEV_PLAN.md` §FOUNDATION-01 for full list):
```
PORT, NODE_ENV, ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD
JWT_SECRET (min 32 chars), JWT_EXPIRY=30m, REFRESH_EXPIRY=30d
REDIS_URL, AFRICASTALKING_API_KEY, AFRICASTALKING_USERNAME
```

**Critical Odoo JSON-RPC pitfall**: Odoo always returns HTTP 200, even for errors. Check the `error` field in the JSON-RPC body — never rely on HTTP status code alone.

---

## Project context

Service: home laundry pickup/delivery in Yaoundé, Cameroon.
Payment: Phase 0 = cash/MoMo on delivery; Phase 1 = Campay (MTN + Orange) via WebView.
SMS: Africa's Talking (+237 Cameroon).
GPS: `res.partner.partner_latitude/longitude` (native Odoo fields, no custom fields needed on the partner).
V2 models (batches, bags, machines, consumables, incidents) are explicitly excluded from this module and will be in a future `franny_laundry_v2` module.
