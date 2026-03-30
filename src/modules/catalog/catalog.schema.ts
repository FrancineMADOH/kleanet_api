// ----------------------------------------------------------------
// Reusable schema fragments
// ----------------------------------------------------------------

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['error'],
} as const;

const garmentTypeSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    default_material: { type: 'string' },
    is_special_item: { type: 'boolean' },
  },
  required: ['id', 'name', 'is_special_item'],
  additionalProperties: false,
} as const;

const pricingRuleSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    mode: { type: 'string', enum: ['per_kg', 'per_piece'] },
    material_name: { type: 'string' },
    garment_type_name: { type: 'string' },
    price: { type: 'number' },
    currency: { type: 'string' },
  },
  required: ['id', 'mode', 'price', 'currency'],
  additionalProperties: false,
} as const;

const subscriptionPlanSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    segment: { type: 'string', enum: ['residential', 'business'] },
    billing_cycle: { type: 'string', enum: ['monthly', 'weekly'] },
    included_weight_kg: { type: 'number' },
    included_pieces: { type: 'number' },
    included_pickups_per_week: { type: 'number' },
    recurring_fee: { type: 'number' },
    overage_price_per_kg: { type: 'number' },
    currency: { type: 'string' },
    description: { type: 'string' },
    target_label: { type: 'string' },
    is_recommended: { type: 'boolean' },
  },
  required: [
    'id', 'name', 'segment', 'billing_cycle',
    'included_weight_kg', 'included_pieces', 'included_pickups_per_week',
    'recurring_fee', 'overage_price_per_kg', 'currency', 'is_recommended',
  ],
  additionalProperties: false,
} as const;

// ----------------------------------------------------------------
// GET /services
// ----------------------------------------------------------------

/** Fastify route schema for GET /api/v1/catalog/services. */
export const getServicesSchema = {
  tags: ['Catalog'],
  summary: 'Get garment types and pricing rules',
  description:
    'Returns the full catalogue: garment types and pricing rules. ' +
    'Cached in Redis for 1 hour. Public — no authentication required.',
  response: {
    200: {
      type: 'object',
      properties: {
        garment_types: { type: 'array', items: garmentTypeSchema },
        pricing_rules: { type: 'array', items: pricingRuleSchema },
        cached_at: { type: 'string' },
      },
      required: ['garment_types', 'pricing_rules'],
      additionalProperties: false,
    },
  },
} as const;

// ----------------------------------------------------------------
// GET /plans
// ----------------------------------------------------------------

/** Fastify route schema for GET /api/v1/catalog/plans. */
export const getPlansSchema = {
  tags: ['Catalog'],
  summary: 'Get active subscription plans',
  description:
    'Returns all active subscription plans. ' +
    'Cached in Redis for 1 hour. Public — no authentication required.',
  response: {
    200: {
      type: 'array',
      items: subscriptionPlanSchema,
    },
  },
} as const;

// ----------------------------------------------------------------
// DELETE /cache
// ----------------------------------------------------------------

/** Fastify route schema for DELETE /api/v1/catalog/cache. */
export const invalidateCacheSchema = {
  tags: ['Catalog'],
  summary: 'Invalidate catalogue cache',
  description:
    'Clears the Redis cache for both /services and /plans. ' +
    'The next request to either endpoint will re-fetch from Odoo. ' +
    'Requires a valid Bearer access token.',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
      additionalProperties: false,
    },
    401: errorSchema,
  },
} as const;
