import type { FastifyInstance } from 'fastify';
import type { OdooRecord } from '../../shared/odoo/odoo.types';
import type {
  DeliveryLocation,
  Profile,
  UpdateLocationInput,
  UpdateProfileInput,
} from './profile.types';

// ----------------------------------------------------------------
// Validation error type
// ----------------------------------------------------------------

/** Structured error thrown by service functions for known business rule violations. */
export interface ProfileServiceError {
  code: string;
  status: number;
  message: string;
}

/**
 * Type guard — returns true if the thrown value is a ProfileServiceError.
 * Used by route handlers to distinguish business errors from infrastructure errors.
 */
export function isProfileServiceError(
  err: unknown,
): err is ProfileServiceError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'status' in err &&
    'message' in err
  );
}

// ----------------------------------------------------------------
// Public service functions
// ----------------------------------------------------------------

/**
 * Returns the profile of the given partner.
 * The partnerId comes from the JWT — if the record is missing it is an infra error, not a 404.
 */
export async function getProfile(
  fastify: FastifyInstance,
  partnerId: number,
): Promise<Profile> {
  const partners = await fastify.odoo.searchRead(
    'res.partner',
    [['id', '=', partnerId]],
    ['id', 'name', 'email', 'phone', 'partner_latitude', 'partner_longitude'],
  );

  return mapToProfile(partners[0]);
}

/**
 * Updates name and/or email for the given partner.
 *
 * Throws ProfileServiceError (400) if neither field is provided.
 * Throws ProfileServiceError (409) if the email is already used by another partner.
 */
export async function updateProfile(
  fastify: FastifyInstance,
  partnerId: number,
  input: UpdateProfileInput,
): Promise<Profile> {
  const hasName = typeof input.name === 'string' && input.name.trim().length > 0;
  const hasEmail = typeof input.email === 'string' && input.email.trim().length > 0;

  if (!hasName && !hasEmail) {
    throw {
      code: 'NOTHING_TO_UPDATE',
      status: 400,
      message: 'Provide at least name or email.',
    } satisfies ProfileServiceError;
  }

  if (hasEmail) {
    await checkEmailNotDuplicated(fastify, input.email!.trim(), partnerId);
  }

  const vals: Record<string, unknown> = {};
  if (hasName) vals.name = input.name!.trim();
  if (hasEmail) vals.email = input.email!.trim();

  await fastify.odoo.write('res.partner', [partnerId], vals);

  return getProfile(fastify, partnerId);
}

/**
 * Saves GPS coordinates on the partner record.
 *
 * Throws ProfileServiceError (400) if coordinates are (0, 0) — the Odoo unset default.
 * Range validation (-90/90 lat, -180/180 lon) is enforced by the request body schema.
 */
export async function updateLocation(
  fastify: FastifyInstance,
  partnerId: number,
  input: UpdateLocationInput,
): Promise<Profile> {
  // (0, 0) is the Odoo default for unset coordinates — reject explicitly
  if (input.latitude === 0 && input.longitude === 0) {
    throw {
      code: 'INVALID_COORDINATES',
      status: 400,
      message: 'Coordinates (0, 0) are not valid — GPS fix not acquired.',
    } satisfies ProfileServiceError;
  }

  await fastify.odoo.write('res.partner', [partnerId], {
    partner_latitude: input.latitude,
    partner_longitude: input.longitude,
  });

  return getProfile(fastify, partnerId);
}

// ----------------------------------------------------------------
// Private — validation helpers
// ----------------------------------------------------------------

/**
 * Throws ProfileServiceError (409) if another partner already uses this email.
 */
async function checkEmailNotDuplicated(
  fastify: FastifyInstance,
  email: string,
  currentPartnerId: number,
): Promise<void> {
  const duplicates = await fastify.odoo.searchRead(
    'res.partner',
    [['email', '=', email], ['id', '!=', currentPartnerId]],
    ['id'],
    { limit: 1 },
  );

  if (duplicates.length > 0) {
    throw {
      code: 'DUPLICATE_ACCOUNT',
      status: 409,
      message: 'This email is already linked to another account.',
    } satisfies ProfileServiceError;
  }
}

// ----------------------------------------------------------------
// Private — mapper
// ----------------------------------------------------------------

/**
 * Maps an Odoo res.partner record to a Profile.
 */
function mapToProfile(rec: OdooRecord): Profile {
  const lat = (rec.partner_latitude as number) || 0;
  const lon = (rec.partner_longitude as number) || 0;
  // Treat (0, 0) as "no location" — Odoo stores 0.0 when the field is unset
  const hasLocation = lat !== 0 || lon !== 0;

  const location: DeliveryLocation | null = hasLocation
    ? { latitude: lat, longitude: lon }
    : null;

  return {
    id: rec.id,
    name: rec.name as string,
    email: rec.email ? (rec.email as string) : undefined,
    phone: rec.phone ? (rec.phone as string) : undefined,
    delivery_location: location,
  };
}
