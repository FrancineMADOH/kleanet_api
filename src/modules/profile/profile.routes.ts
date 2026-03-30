import type { FastifyInstance } from 'fastify';
import { getProfileSchema, updateProfileSchema, updateLocationSchema } from './profile.schema';
import {
  getProfile,
  updateProfile,
  updateLocation,
  isProfileServiceError,
} from './profile.service';
import { authGuard } from '../../shared/guards/auth.guard';
import type { UpdateProfileInput, UpdateLocationInput } from './profile.types';

/**
 * Profile routes plugin — mounts under /api/v1/profile.
 *
 * GET   /          — read my profile (JWT required)
 * PATCH /          — update name / email (JWT required)
 * PATCH /location  — save GPS coordinates (JWT required)
 */
async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // GET /
  // ----------------------------------------------------------------
  fastify.get(
    '/',
    { preHandler: authGuard, schema: getProfileSchema },
    async (request, reply) => {
      const profile = await getProfile(fastify, request.user.partner_id);
      return reply.code(200).send(profile);
    },
  );

  // ----------------------------------------------------------------
  // PATCH /
  // ----------------------------------------------------------------
  fastify.patch<{ Body: UpdateProfileInput }>(
    '/',
    { preHandler: authGuard, schema: updateProfileSchema },
    async (request, reply) => {
      try {
        const profile = await updateProfile(fastify, request.user.partner_id, request.body);
        return reply.code(200).send(profile);
      } catch (err) {
        if (isProfileServiceError(err)) {
          return reply.code(err.status).send({ error: err.code, message: err.message });
        }
        // Re-throw infrastructure errors (Odoo failures) to Fastify's 500 handler
        throw err;
      }
    },
  );

  // ----------------------------------------------------------------
  // PATCH /location
  // ----------------------------------------------------------------
  fastify.patch<{ Body: UpdateLocationInput }>(
    '/location',
    { preHandler: authGuard, schema: updateLocationSchema },
    async (request, reply) => {
      try {
        const profile = await updateLocation(fastify, request.user.partner_id, request.body);
        return reply.code(200).send(profile);
      } catch (err) {
        if (isProfileServiceError(err)) {
          return reply.code(err.status).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}

// Routes plugins must NOT be wrapped with fastify-plugin — fp() disables scope
// isolation, which causes the prefix option to be ignored in Fastify 5.
export default profileRoutes;
