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

const orderStatusEnum = [
  'pending', 'received', 'processing', 'ready_for_pickup', 'delivered', 'cancelled',
] as const;

const orderLineSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    garment_type_id: { type: 'number' },
    garment_type_name: { type: 'string' },
    material_id: { type: 'number' },
    material_name: { type: 'string' },
    quantity: { type: 'number' },
    weight_kg: { type: 'number' },
    unit_price: { type: 'number' },
    subtotal: { type: 'number' },
  },
  required: ['id', 'quantity', 'weight_kg', 'unit_price', 'subtotal'],
  additionalProperties: false,
} as const;

const orderSummaryProperties = {
  id: { type: 'number' },
  reference: { type: 'string' },
  status: { type: 'string', enum: orderStatusEnum },
  amount_total: { type: 'number' },
  currency: { type: 'string' },
  total_pieces: { type: 'number' },
  date_received: { type: 'string' },
  date_ready: { type: 'string' },
} as const;

const orderSummaryRequired = [
  'id', 'reference', 'status', 'amount_total', 'currency', 'total_pieces',
] as const;

const orderSummarySchema = {
  type: 'object',
  properties: orderSummaryProperties,
  required: orderSummaryRequired,
  additionalProperties: false,
} as const;

const orderDetailSchema = {
  type: 'object',
  properties: {
    ...orderSummaryProperties,
    lines: { type: 'array', items: orderLineSchema },
    notes: { type: 'string' },
    subscription_id: { type: 'number' },
    delivery_latitude: { type: 'number' },
    delivery_longitude: { type: 'number' },
    tracking_url: { type: 'string' },
  },
  required: [...orderSummaryRequired, 'lines', 'tracking_url'],
  additionalProperties: false,
} as const;

const createOrderLineSchema = {
  type: 'object',
  required: ['garment_type_id'],
  additionalProperties: false,
  properties: {
    garment_type_id: { type: 'number', minimum: 1 },
    material_id: { type: 'number', minimum: 1 },
    quantity: { type: 'number', minimum: 0 },
    weight_kg: { type: 'number', minimum: 0 },
  },
} as const;

// ----------------------------------------------------------------
// POST /
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/orders. */
export const createOrderSchema = {
  tags: ['Orders'],
  summary: 'Create a laundry order',
  description:
    'Creates a new laundry order with one or more lines. ' +
    'The partner_id is taken from the JWT — never passed in the body. ' +
    'Odoo computes unit prices and subtotals server-side.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['lines'],
    additionalProperties: false,
    properties: {
      lines: {
        type: 'array',
        items: createOrderLineSchema,
        minItems: 1,
        description: 'At least one order line required.',
      },
      notes: { type: 'string', description: 'Optional notes for the driver or team.' },
      subscription_id: { type: 'number', minimum: 1, description: 'Active subscription to apply.' },
      delivery_location: {
        type: 'object',
        required: ['latitude', 'longitude'],
        additionalProperties: false,
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
        },
      },
    },
  },
  response: {
    200: orderDetailSchema,
    400: errorSchema,
    401: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// GET /
// ----------------------------------------------------------------

/** Fastify route schema for GET /api/v1/orders. */
export const listOrdersSchema = {
  tags: ['Orders'],
  summary: 'List my orders',
  description: "Returns a paginated list of the authenticated partner's orders, newest first.",
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      status: { type: 'string', enum: orderStatusEnum },
    },
  },
  response: {
    200: { type: 'array', items: orderSummarySchema },
    401: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// GET /:id
// ----------------------------------------------------------------

/** Fastify route schema for GET /api/v1/orders/:id. */
export const getOrderSchema = {
  tags: ['Orders'],
  summary: 'Get order detail',
  description:
    'Returns full detail for a specific order including lines. ' +
    'Returns 404 if the order does not exist or belongs to another partner.',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  response: {
    200: orderDetailSchema,
    400: errorSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;
