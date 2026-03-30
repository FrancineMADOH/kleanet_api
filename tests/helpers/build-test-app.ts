import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { OdooClient } from '../../src/shared/odoo/odoo-client';
import type Redis from 'ioredis';
import swaggerPlugin from '../../src/plugins/swagger';
import jwtPlugin from '../../src/plugins/jwt';
import authRoutes from '../../src/modules/auth/auth.routes';
import catalogRoutes from '../../src/modules/catalog/catalog.routes';
import ordersRoutes from '../../src/modules/orders/orders.routes';
import appointmentsRoutes from '../../src/modules/appointments/appointments.routes';
import subscriptionRoutes from '../../src/modules/subscription/subscription.routes';
import profileRoutes from '../../src/modules/profile/profile.routes';
import feedbackRoutes from '../../src/modules/feedback/feedback.routes';
import faqRoutes from '../../src/modules/faq/faq.routes';
import { createMockOdoo, createMockRedis } from './mock-factories';
import type { MockOdoo, MockRedis } from './mock-factories';

export interface TestApp {
  app: FastifyInstance;
  mockOdoo: MockOdoo;
  mockRedis: MockRedis;
}

/**
 * Builds a Fastify instance for testing.
 *
 * Real plugins: swagger, jwt (needed for token signing + verification).
 * Mock plugins: odoo, redis (no real network calls in tests).
 * All route modules are registered with the same prefixes as production.
 */
export async function buildTestApp(): Promise<TestApp> {
  const app = Fastify({ logger: false });

  const mockOdoo = createMockOdoo();
  const mockRedis = createMockRedis();

  app.register(swaggerPlugin);
  app.register(jwtPlugin);

  // Inject mock Odoo client — bypasses real JSON-RPC connection
  app.register(
    fp(async (f) => {
      f.decorate('odoo', mockOdoo as unknown as OdooClient);
    }),
  );

  // Inject mock Redis client — bypasses real Redis connection
  app.register(
    fp(async (f) => {
      f.decorate('redis', mockRedis as unknown as Redis);
    }),
  );

  // Register all route modules (same prefixes as app.ts)
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(catalogRoutes, { prefix: '/api/v1/catalog' });
  app.register(ordersRoutes, { prefix: '/api/v1/orders' });
  app.register(appointmentsRoutes, { prefix: '/api/v1/appointments' });
  app.register(subscriptionRoutes, { prefix: '/api/v1/subscription' });
  app.register(profileRoutes, { prefix: '/api/v1/profile' });
  app.register(feedbackRoutes, { prefix: '/api/v1/feedback' });
  app.register(faqRoutes, { prefix: '/api/v1/faq' });

  await app.ready();

  return { app, mockOdoo, mockRedis };
}
