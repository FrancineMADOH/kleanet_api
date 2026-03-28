/** Number of digits in a one-time password. */
export const OTP_LENGTH = 6;

/** OTP time-to-live in seconds (5 minutes). */
export const OTP_TTL_SECONDS = 300;

/** Maximum failed OTP attempts before the code is invalidated. */
export const OTP_MAX_ATTEMPTS = 5;

/** Redis key prefix for OTP entries — e.g. "otp:+237600000000". */
export const REDIS_PREFIX_OTP = 'otp:';

/** Redis key prefix for JWT refresh token entries. */
export const REDIS_PREFIX_REFRESH = 'refresh:';

/** Redis TTL for catalogue data in seconds (1 hour). */
export const CATALOG_CACHE_TTL = 3600;
