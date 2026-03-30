import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app';
import { signJwt } from '../helpers/mock-factories';
import type { TestApp } from '../helpers/build-test-app';

// Sample Odoo records returned on cache miss
const SAMPLE_GARMENT = {
  id: 1,
  name: 'Chemise',
  default_material_id: false,
  is_special_item: false,
};

const SAMPLE_PRICING = {
  id: 1,
  mode: 'per_kg',
  material_id: false,
  garment_type_id: false,
  price: 1500,
  currency_id: [1, 'XAF'],
};

const SAMPLE_PLAN = {
  id: 1,
  name: 'Essentiel',
  segment: 'residential',
  billing_cycle: 'monthly',
  included_weight_kg: 10,
  included_pieces: 20,
  included_pickups_per_week: 2,
  recurring_fee: 15000,
  overage_price_per_kg: 1800,
  currency_id: [1, 'XAF'],
  description: false,
  target_label: false,
  is_recommended: true,
};

let testApp: TestApp;

beforeEach(async () => {
  testApp = await buildTestApp();
});

afterEach(async () => {
  await testApp.app.close();
});

// ----------------------------------------------------------------
// GET /api/v1/catalog/services
// ----------------------------------------------------------------

describe('GET /api/v1/catalog/services', () => {
  it('returns 200 with garment types and pricing rules on cache miss', async () => {
    testApp.mockRedis.get.mockResolvedValue(null); // cache miss
    testApp.mockOdoo.searchRead
      .mockResolvedValueOnce([SAMPLE_GARMENT])
      .mockResolvedValueOnce([SAMPLE_PRICING]);

    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/catalog/services',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.garment_types).toHaveLength(1);
    expect(body.garment_types[0].name).toBe('Chemise');
    expect(body.pricing_rules).toHaveLength(1);
    expect(body.cached_at).toBeDefined();
  });

  it('does NOT call Odoo when cached data is available (cache hit)', async () => {
    const cachedPayload = JSON.stringify({
      garment_types: [{ id: 1, name: 'Chemise', is_special_item: false }],
      pricing_rules: [],
      cached_at: '2026-03-30T10:00:00.000Z',
    });
    testApp.mockRedis.get.mockResolvedValue(cachedPayload); // cache hit

    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/catalog/services',
    });

    expect(res.statusCode).toBe(200);
    // Odoo must NOT have been called — results came from cache
    expect(testApp.mockOdoo.searchRead).not.toHaveBeenCalled();
  });

  it('stores Odoo result in Redis after cache miss', async () => {
    testApp.mockRedis.get.mockResolvedValue(null);
    testApp.mockOdoo.searchRead
      .mockResolvedValueOnce([SAMPLE_GARMENT])
      .mockResolvedValueOnce([SAMPLE_PRICING]);

    await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/catalog/services',
    });

    expect(testApp.mockRedis.set).toHaveBeenCalledOnce();
    const [key, , , ttl] = testApp.mockRedis.set.mock.calls[0];
    expect(key).toBe('catalog:services');
    expect(ttl).toBe(3600);
  });
});

// ----------------------------------------------------------------
// GET /api/v1/catalog/plans
// ----------------------------------------------------------------

describe('GET /api/v1/catalog/plans', () => {
  it('returns 200 with subscription plans on cache miss', async () => {
    testApp.mockRedis.get.mockResolvedValue(null);
    testApp.mockOdoo.searchRead.mockResolvedValueOnce([SAMPLE_PLAN]);

    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/catalog/plans',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].name).toBe('Essentiel');
  });
});

// ----------------------------------------------------------------
// DELETE /api/v1/catalog/cache
// ----------------------------------------------------------------

describe('DELETE /api/v1/catalog/cache', () => {
  it('returns 401 without a Bearer token', async () => {
    const res = await testApp.app.inject({
      method: 'DELETE',
      url: '/api/v1/catalog/cache',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 200 and calls redis.del with all three cache keys (services + plans + faq)', async () => {
    const token = signJwt(testApp.app, 1);

    const res = await testApp.app.inject({
      method: 'DELETE',
      url: '/api/v1/catalog/cache',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);

    // Verify all three cache keys are deleted in one call
    const delArgs: string[] = testApp.mockRedis.del.mock.calls[0];
    expect(delArgs).toContain('catalog:services');
    expect(delArgs).toContain('catalog:plans');
    expect(delArgs).toContain('catalog:faq');
  });
});
