import { vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { JwtPayload } from '../../src/types/fastify';

// ----------------------------------------------------------------
// Mock Odoo client
// ----------------------------------------------------------------

/**
 * Returns a mock OdooClient with all methods as Vitest spies.
 * Default return values are the "happy path" for each method.
 */
export function createMockOdoo() {
  return {
    searchRead: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(1),
    write: vi.fn().mockResolvedValue(true),
    searchCount: vi.fn().mockResolvedValue(0),
    call: vi.fn().mockResolvedValue(null),
  };
}

export type MockOdoo = ReturnType<typeof createMockOdoo>;

// ----------------------------------------------------------------
// Mock Redis client
// ----------------------------------------------------------------

/**
 * Returns a mock ioredis client with all methods used by the app as Vitest spies.
 * Default return values: get → null (miss), set → 'OK', del → 1, incr → 1.
 */
export function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
  };
}

export type MockRedis = ReturnType<typeof createMockRedis>;

// ----------------------------------------------------------------
// JWT helper
// ----------------------------------------------------------------

/**
 * Signs a valid access token for a given partner using the test app's JWT plugin.
 * Use this to set the Authorization header in inject() calls.
 */
export function signJwt(app: FastifyInstance, partnerId: number): string {
  const payload: JwtPayload = {
    sub: String(partnerId),
    partner_id: partnerId,
  };
  return app.jwt.sign(payload);
}
