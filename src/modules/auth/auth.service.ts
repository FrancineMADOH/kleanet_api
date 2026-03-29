import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/env';
import { generateOtp, storeOtp, verifyOtp } from '../../shared/otp/otp.service';
import { getSmsProvider } from '../../shared/otp/sms.service';
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

// ----------------------------------------------------------------
// Private helpers
// ----------------------------------------------------------------

interface PartnerResolution {
  partnerId: number;
  isNewUser: boolean;
}

/**
 * Finds an existing Odoo partner by phone or mobile field.
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
