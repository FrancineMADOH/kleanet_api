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

const feedbackResultSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    reference: { type: 'string', description: 'Feedback reference (e.g. FBK/2026/00001).' },
    order_id: { type: 'number' },
    rating: { type: 'integer', minimum: 1, maximum: 5 },
    would_recommend: { type: 'boolean' },
    comment: { type: 'string' },
    submitted_at: { type: 'string', description: 'ISO 8601 UTC datetime.' },
  },
  required: ['id', 'reference', 'order_id', 'rating', 'submitted_at'],
  additionalProperties: false,
} as const;

// ----------------------------------------------------------------
// POST /
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/feedback. */
export const submitFeedbackSchema = {
  tags: ['Feedback'],
  summary: 'Submit feedback for a delivered order',
  description:
    'Creates a customer feedback entry for the given order. ' +
    'The order must be in delivered state and must belong to the authenticated partner. ' +
    'Only one feedback per order is allowed.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['order_id', 'rating'],
    additionalProperties: false,
    properties: {
      order_id: {
        type: 'integer',
        minimum: 1,
        description: 'ID of the delivered order to review.',
      },
      rating: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        description: 'Rating from 1 (worst) to 5 (best).',
      },
      comment: {
        type: 'string',
        description: 'Optional free-text comment.',
      },
      would_recommend: {
        type: 'boolean',
        description: 'Whether the customer would recommend the service.',
      },
    },
  },
  response: {
    201: feedbackResultSchema,
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    409: errorSchema,
  },
} as const;
