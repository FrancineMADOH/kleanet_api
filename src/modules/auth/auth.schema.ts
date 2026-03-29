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

// ----------------------------------------------------------------
// POST /phone/send
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/auth/phone/send. */
export const sendOtpSchema = {
  tags: ['Auth'],
  summary: 'Send OTP via SMS',
  description:
    'Sends a 6-digit OTP to the provided E.164 phone number. ' +
    'Limited to 3 requests per 10-minute window per phone number.',
  body: {
    type: 'object',
    required: ['phone'],
    additionalProperties: false,
    properties: {
      phone: {
        type: 'string',
        pattern: '^\\+[1-9]\\d{7,14}$',
        description: 'E.164 phone number, e.g. +237612345678',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
      additionalProperties: false,
    },
    400: errorSchema,
    429: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// POST /phone/verify
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/auth/phone/verify. */
export const verifyOtpSchema = {
  tags: ['Auth'],
  summary: 'Verify OTP and return JWT tokens',
  description:
    'Verifies the 6-digit OTP and returns access + refresh tokens. ' +
    'Creates a new Odoo partner if the phone number is not yet registered.',
  body: {
    type: 'object',
    required: ['phone', 'code'],
    additionalProperties: false,
    properties: {
      phone: {
        type: 'string',
        pattern: '^\\+[1-9]\\d{7,14}$',
        description: 'E.164 phone number',
      },
      code: {
        type: 'string',
        pattern: '^\\d{6}$',
        description: '6-digit OTP received by SMS',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        partner_id: { type: 'number' },
        is_new_user: { type: 'boolean' },
      },
      required: ['access_token', 'refresh_token', 'partner_id', 'is_new_user'],
      additionalProperties: false,
    },
    400: errorSchema,
  },
} as const;
