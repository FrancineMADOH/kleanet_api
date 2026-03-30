import Fastify, { FastifyInstance } from 'fastify';
import swaggerPlugin from './plugins/swagger';
import odooPlugin from './shared/odoo/odoo-client';
import jwtPlugin from './plugins/jwt';
import redisPlugin from './plugins/redis';
import authRoutes from './modules/auth/auth.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import ordersRoutes from './modules/orders/orders.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import profileRoutes from './modules/profile/profile.routes';
import feedbackRoutes from './modules/feedback/feedback.routes';
import { authGuard } from './shared/guards/auth.guard';

/**
 * Builds and returns a configured Fastify application instance.
 *
 * Registers all plugins and routes. The caller is responsible for
 * calling `fastify.listen()` to bind to a port — this separation
 * makes the app easy to test without opening a real socket.
 */
export function buildApp(): FastifyInstance {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
  });

  // Swagger must be registered before routes so all schemas are captured
  fastify.register(swaggerPlugin);
  // Odoo client available as fastify.odoo throughout the app
  fastify.register(odooPlugin);
  // JWT available as fastify.jwt throughout the app
  fastify.register(jwtPlugin);
  // Redis client available as fastify.redis throughout the app
  fastify.register(redisPlugin);
  // Auth routes — /api/v1/auth/phone/send, /api/v1/auth/phone/verify
  fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  fastify.register(catalogRoutes, { prefix: '/api/v1/catalog' });
  fastify.register(ordersRoutes, { prefix: '/api/v1/orders' });
  fastify.register(appointmentsRoutes, { prefix: '/api/v1/appointments' });
  fastify.register(subscriptionRoutes, { prefix: '/api/v1/subscription' });
  fastify.register(profileRoutes, { prefix: '/api/v1/profile' });
  fastify.register(feedbackRoutes, { prefix: '/api/v1/feedback' });

  // ----------------------------------------------------------------
  // Health check — used by load balancers and Docker health checks
  // ----------------------------------------------------------------
  fastify.get(
    '/ping',
    {
      schema: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Returns 200 with { pong: true } when the server is up.',
        response: {
          200: {
            type: 'object',
            properties: {
              pong: { type: 'boolean' },
            },
            required: ['pong'],
            additionalProperties: false,
          },
        },
      },
    },
    async () => ({ pong: true }),
  );

  // ----------------------------------------------------------------
  // Test routes — removed in QUALITY-02
  // ----------------------------------------------------------------
  fastify.get(
    '/test/public',
    {
      schema: {
        tags: ['System'],
        summary: 'Public test route',
        description: 'Always returns 200. No authentication required.',
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
            additionalProperties: false,
          },
        },
      },
    },
    async () => ({ ok: true }),
  );

  fastify.get(
    '/test/private',
    {
      preHandler: authGuard,
      schema: {
        tags: ['System'],
        summary: 'Private test route',
        description: 'Requires a valid Bearer JWT. Returns partner_id from the token.',
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              partner_id: { type: 'number' },
            },
            required: ['ok', 'partner_id'],
            additionalProperties: false,
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => ({ ok: true, partner_id: request.user.partner_id }),
  );

  return fastify;
}
