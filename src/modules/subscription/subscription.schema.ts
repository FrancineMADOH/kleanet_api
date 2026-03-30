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

const usageSchema = {
  type: 'object',
  properties: {
    orders_this_period: { type: 'integer', description: 'Orders placed this billing period.' },
    weight_used_kg: { type: 'number', description: 'Weight (kg) consumed this period.' },
    remaining_weight_kg: { type: 'number', description: 'Weight (kg) remaining before overage.' },
  },
  required: ['orders_this_period', 'weight_used_kg', 'remaining_weight_kg'],
  additionalProperties: false,
} as const;

const activeSubscriptionSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    reference: { type: 'string', description: 'Subscription reference (e.g. SUB/2026/00001).' },
    plan_name: { type: 'string' },
    billing_cycle: { type: 'string', enum: ['monthly', 'weekly'] },
    included_weight_kg: { type: 'number' },
    included_pieces: { type: 'number' },
    included_pickups_per_week: { type: 'integer' },
    recurring_fee: { type: 'number' },
    overage_price_per_kg: { type: 'number' },
    currency: { type: 'string', description: 'ISO 4217 currency code (e.g. XAF).' },
    start_date: { type: 'string', description: 'Start date — YYYY-MM-DD.' },
    end_date: { type: 'string', description: 'End date — YYYY-MM-DD (optional).' },
    state: { type: 'string', enum: ['active', 'paused', 'cancelled'] },
    usage: usageSchema,
  },
  required: [
    'id', 'reference', 'plan_name', 'billing_cycle',
    'included_weight_kg', 'included_pieces', 'included_pickups_per_week',
    'recurring_fee', 'overage_price_per_kg', 'currency',
    'start_date', 'state', 'usage',
  ],
  additionalProperties: false,
} as const;

// ----------------------------------------------------------------
// GET /
// ----------------------------------------------------------------

/** Fastify route schema for GET /api/v1/subscription. */
export const getSubscriptionSchema = {
  tags: ['Subscription'],
  summary: 'Get my active subscription',
  description:
    'Returns the active or paused subscription for the authenticated partner. ' +
    'Returns { subscription: null } if the partner has no active subscription.',
  security: [{ BearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        subscription: {
          oneOf: [activeSubscriptionSchema, { type: 'null' }],
        },
      },
      required: ['subscription'],
      additionalProperties: false,
    },
    401: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// POST /
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/subscription. */
export const subscribeSchema = {
  tags: ['Subscription'],
  summary: 'Subscribe to a plan',
  description:
    'Creates a new subscription for the authenticated partner from the given plan. ' +
    'Returns 409 if the partner already has an active or paused subscription.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['plan_id'],
    additionalProperties: false,
    properties: {
      plan_id: {
        type: 'integer',
        minimum: 1,
        description: 'ID of the subscription plan to subscribe to.',
      },
    },
  },
  response: {
    200: activeSubscriptionSchema,
    401: errorSchema,
    404: errorSchema,
    409: errorSchema,
  },
} as const;
