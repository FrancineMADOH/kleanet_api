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

const appointmentSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    reference: { type: 'string' },
    type: { type: 'string', enum: ['pickup', 'delivery'] },
    status: {
      type: 'string',
      enum: ['requested', 'scheduled', 'on_route', 'arrived', 'done', 'cancelled'],
    },
    scheduled_from: { type: 'string', description: 'ISO 8601 UTC datetime.' },
    scheduled_to: { type: 'string', description: 'ISO 8601 UTC datetime.' },
  },
  required: ['id', 'reference', 'type', 'status', 'scheduled_from'],
  additionalProperties: false,
} as const;

// ----------------------------------------------------------------
// POST /
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/appointments. */
export const createAppointmentSchema = {
  tags: ['Appointments'],
  summary: 'Create a pickup or delivery appointment',
  description:
    'Books a new appointment for the authenticated partner. ' +
    'scheduled_from must be at least 2 hours from now. ' +
    'order_ids, if provided, must all belong to the authenticated partner.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['type', 'scheduled_from'],
    additionalProperties: false,
    properties: {
      type: {
        type: 'string',
        enum: ['pickup', 'delivery'],
        description: 'Type of appointment.',
      },
      scheduled_from: {
        type: 'string',
        description: 'ISO 8601 datetime — minimum 2 hours from now.',
      },
      scheduled_to: {
        type: 'string',
        description: 'ISO 8601 datetime — optional end of the time slot.',
      },
      order_ids: {
        type: 'array',
        items: { type: 'number', minimum: 1 },
        description: 'Laundry order IDs to link to this appointment.',
      },
      subscription_id: {
        type: 'number',
        minimum: 1,
        description: 'Active subscription to associate.',
      },
      notes: {
        type: 'string',
        description: 'Optional notes for the driver or operations team.',
      },
    },
  },
  response: {
    200: appointmentSummarySchema,
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// GET /
// ----------------------------------------------------------------

/** Fastify route schema for GET /api/v1/appointments. */
export const listAppointmentsSchema = {
  tags: ['Appointments'],
  summary: 'List my appointments',
  description: "Returns all appointments for the authenticated partner, newest first.",
  security: [{ BearerAuth: [] }],
  response: {
    200: { type: 'array', items: appointmentSummarySchema },
    401: errorSchema,
  },
} as const;
