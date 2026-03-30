import type { FastifyInstance } from 'fastify';
import { getServicesSchema, getPlansSchema, invalidateCacheSchema } from './catalog.schema';
import { getCatalog, getPlans, invalidateCache } from './catalog.service';
import { authGuard } from '../../shared/guards/auth.guard';

/**
 * Catalog routes plugin — mounts under the prefix registered in app.ts (/api/v1/catalog).
 *
 * GET    /services — garment types + pricing rules (public, Redis-cached 1h)
 * GET    /plans    — active subscription plans (public, Redis-cached 1h)
 * DELETE /cache    — invalidate both caches (requires valid JWT)
 */
async function catalogRoutes(fastify: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // GET /services
  // ----------------------------------------------------------------
  fastify.get(
    '/services',
    { schema: getServicesSchema },
    async (_request, reply) => {
      const data = await getCatalog(fastify);
      reply.header('Cache-Control', 'public, max-age=3600');
      return reply.code(200).send(data);
    },
  );

  // ----------------------------------------------------------------
  // GET /plans
  // ----------------------------------------------------------------
  fastify.get(
    '/plans',
    { schema: getPlansSchema },
    async (_request, reply) => {
      const plans = await getPlans(fastify);
      reply.header('Cache-Control', 'public, max-age=3600');
      return reply.code(200).send(plans);
    },
  );

  // ----------------------------------------------------------------
  // DELETE /cache  (protected — requires valid access token)
  // ----------------------------------------------------------------
  fastify.delete(
    '/cache',
    { preHandler: authGuard, schema: invalidateCacheSchema },
    async (_request, reply) => {
      await invalidateCache(fastify);
      return reply.code(200).send({ message: 'Cache invalidated' });
    },
  );
}

// Routes plugins must NOT be wrapped with fastify-plugin — fp() disables scope
// isolation, which causes the prefix option to be ignored in Fastify 5.
export default catalogRoutes;
