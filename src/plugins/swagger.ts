import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

/**
 * Registers Swagger (OpenAPI 3.0 spec generation) and Swagger UI
 * (interactive docs at /docs) on the Fastify instance.
 *
 * Must be registered before any route so that all route schemas are
 * captured in the generated spec. Wrapped with fastify-plugin so the
 * swagger decorator is visible outside this plugin's scope.
 */
async function swaggerPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Kleanet API',
        description:
          'Middleware API for the Kleanet laundry-on-demand service (Yaoundé, Cameroon). ' +
          'Connects the Flutter mobile app to the Odoo 19 back-office.',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development',
        },
      ],
      components: {
        securitySchemes: {
          // BearerAuth declared now so routes can reference it from AUTH onwards
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      deepLinking: true,
    },
  });
}

export default fp(swaggerPlugin, { name: 'swagger' });
