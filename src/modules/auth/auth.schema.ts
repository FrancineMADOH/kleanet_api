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

// ----------------------------------------------------------------
// POST /google
// ----------------------------------------------------------------

/** Reusable LoginResponse shape — used by both OTP verify and Google auth. */
const loginResponseSchema = {
  type: 'object',
  properties: {
    access_token: { type: 'string' },
    refresh_token: { type: 'string' },
    partner_id: { type: 'number' },
    is_new_user: { type: 'boolean' },
  },
  required: ['access_token', 'refresh_token', 'partner_id', 'is_new_user'],
  additionalProperties: false,
} as const;

/** Fastify route schema for POST /api/v1/auth/google. */
export const googleAuthSchema = {
  tags: ['Auth'],
  summary: 'Login with Google',
  description:
    'Verifies a Google id_token obtained by the Flutter app via the Google Sign-In SDK. ' +
    'Creates a new Odoo partner if the email is not yet registered.',
  body: {
    type: 'object',
    required: ['id_token'],
    additionalProperties: false,
    properties: {
      id_token: {
        type: 'string',
        minLength: 1,
        description: 'Google id_token from the Flutter Google Sign-In SDK',
      },
    },
  },
  response: {
    200: loginResponseSchema,
    401: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// POST /facebook
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/auth/facebook. */
export const facebookAuthSchema = {
  tags: ['Auth'],
  summary: 'Login with Facebook',
  description:
    'Verifies a Facebook access_token obtained by the Flutter app via the Facebook Login SDK. ' +
    'Creates a new Odoo partner if the email is not yet registered.',
  body: {
    type: 'object',
    required: ['access_token'],
    additionalProperties: false,
    properties: {
      access_token: {
        type: 'string',
        minLength: 1,
        description: 'Facebook access_token from the Flutter Facebook Login SDK',
      },
    },
  },
  response: {
    200: loginResponseSchema,
    401: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// POST /refresh
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/auth/refresh. */
export const refreshSchema = {
  tags: ['Auth'],
  summary: 'Refresh access token',
  description: 'Exchanges a valid refresh token for a new access token (30 min).',
  body: {
    type: 'object',
    required: ['refresh_token'],
    additionalProperties: false,
    properties: {
      refresh_token: {
        type: 'string',
        minLength: 1,
        description: 'Refresh token obtained at login',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { access_token: { type: 'string' } },
      required: ['access_token'],
      additionalProperties: false,
    },
    401: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// POST /logout
// ----------------------------------------------------------------

/** Fastify route schema for POST /api/v1/auth/logout. */
export const logoutSchema = {
  tags: ['Auth'],
  summary: 'Logout — revoke refresh token',
  description:
    'Revokes the provided refresh token in Redis. ' +
    'The access token remains valid until its natural expiry (30 min). ' +
    'Requires a valid Bearer access token in the Authorization header.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['refresh_token'],
    additionalProperties: false,
    properties: {
      refresh_token: {
        type: 'string',
        minLength: 1,
        description: 'Refresh token to revoke',
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
    401: errorSchema,
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
    200: loginResponseSchema,
    400: errorSchema,
  },
} as const;
