import type { FastifyInstance } from 'fastify';
import { getSubscriptionSchema, subscribeSchema } from './subscription.schema';
import {
  getMySubscription,
  subscribe,
  isSubscriptionServiceError,
} from './subscription.service';
import { authGuard } from '../../shared/guards/auth.guard';
import type { SubscribeInput } from './subscription.types';

/**
 * Subscription routes plugin — mounts under /api/v1/subscription.
 *
 * GET  / — get my active subscription (JWT required)
 * POST / — subscribe to a plan (JWT required)
 */
async function subscriptionRoutes(fastify: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // GET /
  // ----------------------------------------------------------------
  fastify.get(
    '/',
    { preHandler: authGuard, schema: getSubscriptionSchema },
    async (request, reply) => {
      const subscription = await getMySubscription(fastify, request.user.partner_id);
      return reply.code(200).send({ subscription });
    },
  );

  // ----------------------------------------------------------------
  // POST /
  // ----------------------------------------------------------------
  fastify.post<{ Body: SubscribeInput }>(
    '/',
    { preHandler: authGuard, schema: subscribeSchema },
    async (request, reply) => {
      try {
        const result = await subscribe(fastify, request.user.partner_id, request.body);
        return reply.code(200).send(result);
      } catch (err) {
        if (isSubscriptionServiceError(err)) {
          return reply.code(err.status).send({
            error: err.code,
            message: err.message,
          });
        }
        // Re-throw infrastructure errors (Odoo/Redis failures) to Fastify's 500 handler
        throw err;
      }
    },
  );
}

// Routes plugins must NOT be wrapped with fastify-plugin — fp() disables scope
// isolation, which causes the prefix option to be ignored in Fastify 5.
export default subscriptionRoutes;
