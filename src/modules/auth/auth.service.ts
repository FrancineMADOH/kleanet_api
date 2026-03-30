import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/env';
import { generateOtp, storeOtp, verifyOtp } from '../../shared/otp/otp.service';
import { getSmsProvider } from '../../shared/otp/sms.service';
import { verifyGoogleToken, GoogleTokenError } from '../../shared/oauth/google.service';
import { verifyFacebookToken, FacebookTokenError } from '../../shared/oauth/facebook.service';
import type { JwtPayload } from '../../types/fastify';
import type { OtpVerifyResult } from '../../shared/otp/otp.service';
import type { LoginResponse, SendOtpResult } from './auth.types';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Max OTP send requests per phone per rate-limit window. */
const OTP_RATE_LIMIT_MAX = 3;

/** Rate-limit window in seconds (10 minutes). */
const OTP_RATE_LIMIT_WINDOW = 600;

/** Refresh token TTL in seconds (30 days). */
const REFRESH_TTL_SECONDS = 30 * 24 * 3600;

/** Redis key prefix for send-rate counters. */
const RATE_LIMIT_PREFIX = 'otp_send_count:';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Builds the Redis key that tracks how many OTPs were sent to a phone. */
function rateLimitKey(phone: string): string {
  return `${RATE_LIMIT_PREFIX}${phone}`;
}

/** Builds the Redis key for a stored refresh token. */
function refreshKey(partnerId: number, jti: string): string {
  return `refresh:${partnerId}:${jti}`;
}

// ----------------------------------------------------------------
// Service functions
// ----------------------------------------------------------------

/**
 * Sends an OTP to the given phone number after checking the rate limit.
 *
 * Returns 'rate_limited' if the phone has already received
 * OTP_RATE_LIMIT_MAX codes within the current window.
 * Returns 'sent' on success.
 */
export async function sendOtp(
  fastify: FastifyInstance,
  phone: string,
): Promise<SendOtpResult> {
  const redis = fastify.redis;
  const key = rateLimitKey(phone);

  const countRaw = await redis.get(key);
  const count = parseInt(countRaw ?? '0', 10);

  if (count >= OTP_RATE_LIMIT_MAX) {
    return 'rate_limited';
  }

  // Increment counter; set expiry only when key is new (NX flag) to preserve
  // the original window start — prevents resetting the window on every send.
  await redis.incr(key);
  await redis.expire(key, OTP_RATE_LIMIT_WINDOW, 'NX');

  const code = generateOtp();
  await storeOtp(redis, phone, code);

  const smsProvider = getSmsProvider(config.NODE_ENV, fastify.log, config);
  await smsProvider.send(phone, `Votre code Kleanet : ${code} (valable 5 minutes)`);

  return 'sent';
}

/**
 * Verifies the OTP and, on success, resolves or creates the Odoo partner
 * then returns a pair of signed JWT tokens.
 *
 * Returns the raw OtpVerifyResult string if verification fails so the
 * route handler can map it to the appropriate HTTP error code.
 */
export async function verifyOtpAndLogin(
  fastify: FastifyInstance,
  phone: string,
  code: string,
): Promise<OtpVerifyResult | LoginResponse> {
  const otpResult = await verifyOtp(fastify.redis, phone, code);

  if (otpResult !== 'valid') {
    return otpResult;
  }

  const { partnerId, isNewUser } = await resolvePartner(fastify, phone);

  const accessToken = fastify.jwt.sign(
    { sub: String(partnerId), partner_id: partnerId, phone },
    { expiresIn: config.JWT_EXPIRY },
  );

  const jti = uuidv4();
  const refreshToken = fastify.jwt.sign(
    { sub: String(partnerId), partner_id: partnerId, jti },
    { expiresIn: config.REFRESH_EXPIRY },
  );

  await fastify.redis.set(refreshKey(partnerId, jti), '1', 'EX', REFRESH_TTL_SECONDS);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    partner_id: partnerId,
    is_new_user: isNewUser,
  };
}

/**
 * Verifies a Google id_token and logs in (or registers) the matching Odoo partner.
 *
 * Returns 'invalid_token' if the token fails verification or GOOGLE_CLIENT_ID
 * is not configured. Returns a LoginResponse on success.
 */
export async function googleLogin(
  fastify: FastifyInstance,
  idToken: string,
): Promise<'invalid_token' | LoginResponse> {
  if (!config.GOOGLE_CLIENT_ID) {
    fastify.log.warn('GOOGLE_CLIENT_ID is not set — Google login is disabled');
    return 'invalid_token';
  }

  let profile;
  try {
    profile = await verifyGoogleToken(idToken, config.GOOGLE_CLIENT_ID);
  } catch (err) {
    if (err instanceof GoogleTokenError) {
      return 'invalid_token';
    }
    throw err;
  }

  const { partnerId, isNewUser } = await resolvePartnerByEmail(fastify, profile.email, profile.name);

  const accessToken = fastify.jwt.sign(
    { sub: String(partnerId), partner_id: partnerId, email: profile.email },
    { expiresIn: config.JWT_EXPIRY },
  );

  const jti = uuidv4();
  const refreshToken = fastify.jwt.sign(
    { sub: String(partnerId), partner_id: partnerId, jti },
    { expiresIn: config.REFRESH_EXPIRY },
  );

  await fastify.redis.set(refreshKey(partnerId, jti), '1', 'EX', REFRESH_TTL_SECONDS);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    partner_id: partnerId,
    is_new_user: isNewUser,
  };
}

/**
 * Verifies a Facebook access_token via the Graph API and logs in (or registers)
 * the matching Odoo partner.
 *
 * Returns 'invalid_token' if verification fails. Returns LoginResponse on success.
 */
export async function facebookLogin(
  fastify: FastifyInstance,
  accessToken: string,
): Promise<'invalid_token' | LoginResponse> {
  let profile;
  try {
    profile = await verifyFacebookToken(accessToken);
  } catch (err) {
    if (err instanceof FacebookTokenError) {
      return 'invalid_token';
    }
    throw err;
  }

  const { partnerId, isNewUser } = await resolvePartnerByEmail(
    fastify,
    profile.email,
    profile.name,
  );

  const newAccessToken = fastify.jwt.sign(
    { sub: String(partnerId), partner_id: partnerId, email: profile.email },
    { expiresIn: config.JWT_EXPIRY },
  );

  const jti = uuidv4();
  const refreshToken = fastify.jwt.sign(
    { sub: String(partnerId), partner_id: partnerId, jti },
    { expiresIn: config.REFRESH_EXPIRY },
  );

  await fastify.redis.set(refreshKey(partnerId, jti), '1', 'EX', REFRESH_TTL_SECONDS);

  return {
    access_token: newAccessToken,
    refresh_token: refreshToken,
    partner_id: partnerId,
    is_new_user: isNewUser,
  };
}

/**
 * Issues a new access token in exchange for a valid, non-revoked refresh token.
 *
 * Returns:
 * - 'invalid'  — JWT signature invalid, expired, or missing jti claim
 * - 'revoked'  — Redis key absent (token was logged out or never stored)
 * - object     — new access_token string
 */
export async function refreshAccessToken(
  fastify: FastifyInstance,
  refreshToken: string,
): Promise<'invalid' | 'revoked' | { access_token: string }> {
  let payload: JwtPayload;
  try {
    payload = await fastify.jwt.verify<JwtPayload>(refreshToken);
  } catch {
    return 'invalid';
  }

  if (!payload.jti) {
    return 'invalid';
  }

  const stored = await fastify.redis.get(refreshKey(payload.partner_id, payload.jti));
  if (stored === null) {
    return 'revoked';
  }

  const newAccessToken = fastify.jwt.sign(
    { sub: payload.sub, partner_id: payload.partner_id },
    { expiresIn: config.JWT_EXPIRY },
  );

  return { access_token: newAccessToken };
}

/**
 * Revokes a refresh token by deleting its Redis key.
 *
 * Idempotent — if the token is already invalid or expired the call is a no-op.
 * The access token remains valid until its natural expiry (max 30 min).
 */
export async function logout(
  fastify: FastifyInstance,
  refreshToken: string,
): Promise<void> {
  let payload: JwtPayload;
  try {
    payload = await fastify.jwt.verify<JwtPayload>(refreshToken);
  } catch {
    // Token already invalid — nothing to revoke, treat as success
    return;
  }

  if (payload.jti) {
    await fastify.redis.del(refreshKey(payload.partner_id, payload.jti));
  }
}

// ----------------------------------------------------------------
// Private helpers
// ----------------------------------------------------------------

interface PartnerResolution {
  partnerId: number;
  isNewUser: boolean;
}

/**
 * Finds an existing Odoo partner by email address.
 * Creates a minimal partner record if none is found.
 *
 * Guard: if email is empty (e.g. Facebook user denied email permission) we
 * skip the email search and create a name-only partner to avoid polluting
 * Odoo with partners whose email is an empty string.
 *
 * NOTE: cross-linking with phone-only partners (created via OTP) is NOT
 * possible here — it requires the user to confirm their email via PROFILE.
 * See the "Partner fragmentation" section in CLAUDE.md.
 */
async function resolvePartnerByEmail(
  fastify: FastifyInstance,
  email: string,
  name: string,
): Promise<PartnerResolution> {
  if (email) {
    const partners = await fastify.odoo.searchRead(
      'res.partner',
      [['email', '=', email]],
      ['id', 'name', 'email', 'phone'],
      { limit: 1 },
    );

    if (partners.length > 0) {
      return { partnerId: partners[0].id, isNewUser: false };
    }
  }

  const partnerData: Record<string, unknown> = { name, customer_rank: 1 };
  if (email) {
    partnerData.email = email;
  }

  const newId = await fastify.odoo.create('res.partner', partnerData);
  return { partnerId: newId, isNewUser: true };
}

/**
 * Finds an existing Odoo partner by phone.
 * Creates a minimal partner record if none is found.
 */
async function resolvePartner(
  fastify: FastifyInstance,
  phone: string,
): Promise<PartnerResolution> {
  // Search by phone only — this Odoo instance does not expose a mobile field
  const partners = await fastify.odoo.searchRead(
    'res.partner',
    [['phone', '=', phone]],
    ['id', 'name', 'email', 'phone'],
    { limit: 1 },
  );

  if (partners.length > 0) {
    return { partnerId: partners[0].id, isNewUser: false };
  }

  const newId = await fastify.odoo.create('res.partner', {
    name: phone,
    phone,
    customer_rank: 1,
  });

  return { partnerId: newId, isNewUser: true };
}
