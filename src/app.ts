import Fastify, { FastifyInstance } from 'fastify';
import swaggerPlugin from './plugins/swagger';
import odooPlugin from './shared/odoo/odoo-client';

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
