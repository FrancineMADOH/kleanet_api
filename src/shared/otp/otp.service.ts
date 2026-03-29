import { randomInt } from 'node:crypto';
import type Redis from 'ioredis';
import {
  REDIS_PREFIX_OTP,
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
} from '../../config/constants';

/** Possible outcomes of an OTP verification attempt. */
export type OtpVerifyResult = 'valid' | 'invalid' | 'expired' | 'max_attempts';

// Redis key helpers — centralised so a typo can't cause a mismatch
const otpKey = (phone: string): string => `${REDIS_PREFIX_OTP}${phone}`;
const attemptsKey = (phone: string): string => `${REDIS_PREFIX_OTP}attempts:${phone}`;

/**
 * Generates a cryptographically random 6-digit OTP string.
 *
 * Uses `crypto.randomInt` — never `Math.random()` which is not
 * cryptographically secure.
 */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Stores an OTP code and resets the attempt counter in Redis.
 *
 * Both keys share the same TTL (OTP_TTL_SECONDS = 300s) so they
 * expire together if the user never attempts verification.
 */
export async function storeOtp(
  redis: Redis,
  phone: string,
  code: string,
): Promise<void> {
  await redis.set(otpKey(phone), code, 'EX', OTP_TTL_SECONDS);
  await redis.set(attemptsKey(phone), '0', 'EX', OTP_TTL_SECONDS);
}

/**
 * Verifies an OTP code against the value stored in Redis.
 *
 * Returns:
 * - 'expired'      — no code found (TTL elapsed or never sent)
 * - 'max_attempts' — attempt counter reached OTP_MAX_ATTEMPTS
 * - 'invalid'      — code does not match; attempt counter incremented
 * - 'valid'        — code matches; both Redis keys deleted (single-use)
 */
export async function verifyOtp(
  redis: Redis,
  phone: string,
  code: string,
): Promise<OtpVerifyResult> {
  const stored = await redis.get(otpKey(phone));

  // Key missing → OTP was never sent or has expired
  if (stored === null) {
    return 'expired';
  }

  const attemptsRaw = await redis.get(attemptsKey(phone));
  const attempts = parseInt(attemptsRaw ?? '0', 10);

  if (attempts >= OTP_MAX_ATTEMPTS) {
    return 'max_attempts';
  }

  if (stored !== code) {
    await redis.incr(attemptsKey(phone));
    return 'invalid';
  }

  // Valid — consume the OTP immediately (single-use)
  await redis.del(otpKey(phone), attemptsKey(phone));
  return 'valid';
}
