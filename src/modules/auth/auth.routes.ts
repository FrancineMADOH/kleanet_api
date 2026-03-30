import type { FastifyInstance } from 'fastify';
import { sendOtpSchema, verifyOtpSchema, googleAuthSchema } from './auth.schema';
import { sendOtp, verifyOtpAndLogin, googleLogin } from './auth.service';
import type { SendOtpInput, VerifyOtpInput } from './auth.types';

/**
 * Auth routes plugin — mounts under the prefix registered in app.ts (/api/v1/auth).
 *
 * POST /phone/send   — sends OTP to a phone number
 * POST /phone/verify — verifies OTP and returns JWT tokens
 * POST /google       — verifies Google id_token and returns JWT tokens
 */
async function authRoutes(fastify: FastifyInstance): Promise<void> {
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
