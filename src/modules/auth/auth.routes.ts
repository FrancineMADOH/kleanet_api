import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {
  sendOtpSchema,
  verifyOtpSchema,
  googleAuthSchema,
  facebookAuthSchema,
  refreshSchema,
  logoutSchema,
} from './auth.schema';
import {
  sendOtp,
  verifyOtpAndLogin,
  googleLogin,
  facebookLogin,
  refreshAccessToken,
  logout,
} from './auth.service';
import { authGuard } from '../../shared/guards/auth.guard';
import type { SendOtpInput, VerifyOtpInput } from './auth.types';

/**
 * Auth routes plugin — mounts under the prefix registered in app.ts (/api/v1/auth).
 *
 * POST /phone/send   — sends OTP to a phone number
 * POST /phone/verify — verifies OTP and returns JWT tokens
 * POST /google       — verifies Google id_token and returns JWT tokens
 * POST /facebook     — verifies Facebook access_token and returns JWT tokens
 * POST /refresh      — exchanges refresh token for a new access token
 * POST /logout       — revokes the refresh token (protected)
 */
async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // HTTP-level rate limit on the OTP send endpoint — 5 requests per minute per IP.
  // This is a first line of defence; the service layer adds a per-phone soft limit
  // (3 requests per 10 minutes stored in Redis) as a second layer.
  await fastify.register(rateLimit, {
    max: 5,
    timeWindow: '1 minute',
    // Apply only to POST /phone/send inside this plugin scope
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please wait before requesting another OTP.',
    }),
  });

  // ----------------------------------------------------------------
  // POST /phone/send
  // ----------------------------------------------------------------
  fastify.post<{ Body: SendOtpInput }>(
    '/phone/send',
    { schema: sendOtpSchema },
    async (request, reply) => {
      const { phone } = request.body;

      const result = await sendOtp(fastify, phone);

      if (result === 'rate_limited') {
        return reply.code(429).send({
          error: 'TOO_MANY_REQUESTS',
          message: 'Too many OTP requests. Please wait 10 minutes before trying again.',
        });
      }

      return reply.code(200).send({ message: 'OTP sent' });
    },
  );

  // ----------------------------------------------------------------
  // POST /phone/verify
  // ----------------------------------------------------------------
  fastify.post<{ Body: VerifyOtpInput }>(
    '/phone/verify',
    { schema: verifyOtpSchema },
    async (request, reply) => {
      const { phone, code } = request.body;

      const result = await verifyOtpAndLogin(fastify, phone, code);

      // String result means OTP verification failed — map to HTTP error.
      // 'valid' is consumed inside verifyOtpAndLogin and never returned here.
      if (typeof result === 'string') {
        return reply.code(400).send(
          otpErrorResponse(result as 'invalid' | 'expired' | 'max_attempts'),
        );
      }

      return reply.code(200).send(result);
    },
  );

  // ----------------------------------------------------------------
  // POST /google
  // ----------------------------------------------------------------
  fastify.post<{ Body: { id_token: string } }>(
    '/google',
    { schema: googleAuthSchema },
    async (request, reply) => {
      const { id_token } = request.body;

      const result = await googleLogin(fastify, id_token);

      if (result === 'invalid_token') {
        return reply.code(401).send({
          error: 'INVALID_GOOGLE_TOKEN',
          message: 'Invalid or expired Google token.',
        });
      }

      return reply.code(200).send(result);
    },
  );

  // ----------------------------------------------------------------
  // POST /facebook
  // ----------------------------------------------------------------
  fastify.post<{ Body: { access_token: string } }>(
    '/facebook',
    { schema: facebookAuthSchema },
    async (request, reply) => {
      const result = await facebookLogin(fastify, request.body.access_token);

      if (result === 'invalid_token') {
        return reply.code(401).send({
          error: 'INVALID_FACEBOOK_TOKEN',
          message: 'Invalid or expired Facebook token.',
        });
      }

      return reply.code(200).send(result);
    },
  );

  // ----------------------------------------------------------------
  // POST /refresh
  // ----------------------------------------------------------------
  fastify.post<{ Body: { refresh_token: string } }>(
    '/refresh',
    { schema: refreshSchema },
    async (request, reply) => {
      const result = await refreshAccessToken(fastify, request.body.refresh_token);

      if (result === 'invalid' || result === 'revoked') {
        return reply.code(401).send({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid, expired, or has been revoked.',
        });
      }

      return reply.code(200).send(result);
    },
  );

  // ----------------------------------------------------------------
  // POST /logout  (protected — requires valid access token)
  // ----------------------------------------------------------------
  fastify.post<{ Body: { refresh_token: string } }>(
    '/logout',
    { preHandler: authGuard, schema: logoutSchema },
    async (request, reply) => {
      await logout(fastify, request.body.refresh_token);
      return reply.code(200).send({ message: 'Logged out' });
    },
  );
}

// ----------------------------------------------------------------
// Private helpers
// ----------------------------------------------------------------

/** Maps an OTP failure code to a structured HTTP error body. */
function otpErrorResponse(result: 'invalid' | 'expired' | 'max_attempts'): {
  error: string;
  message: string;
} {
  const map = {
    invalid: { error: 'INVALID_OTP', message: 'The OTP code is incorrect.' },
    expired: { error: 'EXPIRED_OTP', message: 'The OTP code has expired. Please request a new one.' },
    max_attempts: { error: 'MAX_ATTEMPTS_REACHED', message: 'Too many incorrect attempts. Please request a new OTP.' },
  } as const;

  return map[result];
}

// Routes plugins must NOT be wrapped with fastify-plugin — fp() disables scope
// isolation, which causes the prefix option to be ignored in Fastify 5.
export default authRoutes;
