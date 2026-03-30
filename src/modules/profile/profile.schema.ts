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

const deliveryLocationSchema = {
  type: 'object',
  properties: {
    latitude: { type: 'number', description: 'Latitude in decimal degrees.' },
    longitude: { type: 'number', description: 'Longitude in decimal degrees.' },
  },
  required: ['latitude', 'longitude'],
  additionalProperties: false,
} as const;

const profileSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    email: { type: 'string', description: 'Email address (optional).' },
    phone: { type: 'string', description: 'Phone number (optional).' },
    delivery_location: {
      oneOf: [deliveryLocationSchema, { type: 'null' }],
      description: 'Saved GPS location — null if not yet set.',
    },
  },
  required: ['id', 'name', 'delivery_location'],
  additionalProperties: false,
} as const;

// ----------------------------------------------------------------
// GET /
// ----------------------------------------------------------------

/** Fastify route schema for GET /api/v1/profile. */
export const getProfileSchema = {
  tags: ['Profile'],
  summary: 'Get my profile',
  description: 'Returns the profile of the authenticated partner.',
  security: [{ BearerAuth: [] }],
  response: {
    200: profileSchema,
    401: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// PATCH /
// ----------------------------------------------------------------

/** Fastify route schema for PATCH /api/v1/profile. */
export const updateProfileSchema = {
  tags: ['Profile'],
  summary: 'Update my profile',
  description:
    'Updates name and/or email. At least one field must be provided. ' +
    'Returns 409 if the email is already linked to another account.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'Display name.',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Email address.',
      },
    },
  },
  response: {
    200: profileSchema,
    400: errorSchema,
    401: errorSchema,
    409: errorSchema,
  },
} as const;

// ----------------------------------------------------------------
// PATCH /location
// ----------------------------------------------------------------

/** Fastify route schema for PATCH /api/v1/profile/location. */
export const updateLocationSchema = {
  tags: ['Profile'],
  summary: 'Save my GPS location',
  description:
    'Saves the partner GPS coordinates for pre-filling pickup address. ' +
    'Coordinates (0, 0) are rejected as they represent the Odoo unset default.',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['latitude', 'longitude'],
    additionalProperties: false,
    properties: {
      latitude: {
        type: 'number',
        minimum: -90,
        maximum: 90,
        description: 'Latitude in decimal degrees (-90 to 90).',
      },
      longitude: {
        type: 'number',
        minimum: -180,
        maximum: 180,
        description: 'Longitude in decimal degrees (-180 to 180).',
      },
    },
  },
  response: {
    200: profileSchema,
    400: errorSchema,
    401: errorSchema,
  },
} as const;
