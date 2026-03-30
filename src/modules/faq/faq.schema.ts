// ----------------------------------------------------------------
// Reusable schema fragments
// ----------------------------------------------------------------

const faqCategorySchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
  },
  required: ['id', 'name'],
  additionalProperties: false,
} as const;

const faqItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    reference: { type: 'string', description: 'FAQ reference (e.g. FAQ/2026/00001).' },
    question: { type: 'string' },
    answer: { type: 'string' },
    category: { oneOf: [faqCategorySchema, { type: 'null' }] },
    sequence: { type: 'number' },
  },
  required: ['id', 'reference', 'question', 'answer', 'category', 'sequence'],
  additionalProperties: false,
} as const;

// ----------------------------------------------------------------
// GET /
// ----------------------------------------------------------------

/** Fastify route schema for GET /api/v1/faq. */
export const listFaqSchema = {
  tags: ['FAQ'],
  summary: 'List frequently asked questions',
  description:
    'Returns all published customer-facing FAQs. ' +
    'Filter by category using the optional `category_id` query param. ' +
    'Results are served from Redis cache (TTL 1h). ' +
    'Invalidated by DELETE /api/v1/catalog/cache.',
  querystring: {
    type: 'object',
    properties: {
      category_id: {
        type: 'integer',
        minimum: 1,
        description: 'Filter FAQs by category ID.',
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: faqItemSchema,
    },
  },
} as const;
