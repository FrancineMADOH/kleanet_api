import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app';
import { signJwt } from '../helpers/mock-factories';
import type { TestApp } from '../helpers/build-test-app';

let testApp: TestApp;

beforeEach(async () => {
  testApp = await buildTestApp();
});

afterEach(async () => {
  await testApp.app.close();
});

// ----------------------------------------------------------------
// GET /api/v1/orders — list orders
// ----------------------------------------------------------------

describe('GET /api/v1/orders', () => {
  it('returns 401 without a Bearer token', async () => {
    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('UNAUTHORIZED');
  });

  it('returns 200 with an empty array when partner has no orders', async () => {
    testApp.mockOdoo.searchRead.mockResolvedValue([]);
    const token = signJwt(testApp.app, 42);

    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('partner isolation — domain always contains the authenticated partner_id', async () => {
    testApp.mockOdoo.searchRead.mockResolvedValue([]);
    const token = signJwt(testApp.app, 42);

    await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders',
      headers: { authorization: `Bearer ${token}` },
    });

    const [model, domain] = testApp.mockOdoo.searchRead.mock.calls[0];
    expect(model).toBe('laundry.order');
    // Verify the query is scoped to partner 42 — not all orders
    expect(domain).toContainEqual(['partner_id', '=', 42]);
  });

  it('partner isolation — two partners with different ids query different domains', async () => {
    testApp.mockOdoo.searchRead.mockResolvedValue([]);

    const tokenA = signJwt(testApp.app, 10);
    const tokenB = signJwt(testApp.app, 20);

    await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders',
      headers: { authorization: `Bearer ${tokenA}` },
    });

    await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders',
      headers: { authorization: `Bearer ${tokenB}` },
    });

    const domainA = testApp.mockOdoo.searchRead.mock.calls[0][1];
    const domainB = testApp.mockOdoo.searchRead.mock.calls[1][1];

    expect(domainA).toContainEqual(['partner_id', '=', 10]);
    expect(domainB).toContainEqual(['partner_id', '=', 20]);
    // The two domains must differ — each partner sees only their own orders
    expect(domainA).not.toContainEqual(['partner_id', '=', 20]);
    expect(domainB).not.toContainEqual(['partner_id', '=', 10]);
  });

  it('forwards the status filter to the Odoo domain', async () => {
    testApp.mockOdoo.searchRead.mockResolvedValue([]);
    const token = signJwt(testApp.app, 42);

    await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders?status=delivered',
      headers: { authorization: `Bearer ${token}` },
    });

    const [, domain] = testApp.mockOdoo.searchRead.mock.calls[0];
    expect(domain).toContainEqual(['state', '=', 'delivered']);
  });
});

// ----------------------------------------------------------------
// GET /api/v1/orders/:id — get order detail
// ----------------------------------------------------------------

describe('GET /api/v1/orders/:id', () => {
  it('returns 401 without a Bearer token', async () => {
    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders/1',
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 INVALID_ORDER_ID for non-numeric id', async () => {
    const token = signJwt(testApp.app, 42);

    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders/abc',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_ORDER_ID');
  });

  it('returns 400 INVALID_ORDER_ID for id = 0', async () => {
    const token = signJwt(testApp.app, 42);

    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders/0',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_ORDER_ID');
  });

  it('returns 404 ORDER_NOT_FOUND when order does not exist or belongs to another partner', async () => {
    // Service returns [] → null → route returns 404
    testApp.mockOdoo.searchRead.mockResolvedValue([]);
    const token = signJwt(testApp.app, 42);

    const res = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders/9999',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('ORDER_NOT_FOUND');
  });

  it('partner isolation — domain includes both the order id and the authenticated partner_id', async () => {
    testApp.mockOdoo.searchRead.mockResolvedValue([]);
    const token = signJwt(testApp.app, 42);

    await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/orders/7',
      headers: { authorization: `Bearer ${token}` },
    });

    const [, domain] = testApp.mockOdoo.searchRead.mock.calls[0];
    expect(domain).toContainEqual(['id', '=', 7]);
    expect(domain).toContainEqual(['partner_id', '=', 42]);
  });
});
