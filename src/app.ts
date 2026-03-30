import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
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
import faqRoutes from './modules/faq/faq.routes';

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

  // Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
  // contentSecurityPolicy is disabled — this is a JSON API, not an HTML app,
  // and a strict CSP would break Swagger UI's inline scripts.
  fastify.register(helmet, { contentSecurityPolicy: false });

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
  fastify.register(faqRoutes, { prefix: '/api/v1/faq' });

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

  return fastify;
}
