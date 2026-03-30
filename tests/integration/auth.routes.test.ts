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
// POST /api/v1/auth/phone/send
// ----------------------------------------------------------------

describe('POST /api/v1/auth/phone/send', () => {
  it('returns 400 when body is empty', async () => {
    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/send',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when phone field is missing', async () => {
    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/send',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 429 when the rate limit for this phone is exceeded', async () => {
    // Rate limit counter is already at max
    testApp.mockRedis.get.mockResolvedValue('3');

    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/send',
      payload: { phone: '+237612345678' },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('TOO_MANY_REQUESTS');
  });

  it('returns 200 when phone is valid and rate limit is not exceeded', async () => {
    // Rate limit: not yet counted
    testApp.mockRedis.get.mockResolvedValue(null);

    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/send',
      payload: { phone: '+237612345678' },
    });

    expect(res.statusCode).toBe(200);
  });
});

// ----------------------------------------------------------------
// POST /api/v1/auth/phone/verify
// ----------------------------------------------------------------

describe('POST /api/v1/auth/phone/verify', () => {
  it('returns 400 when body is empty', async () => {
    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/verify',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 EXPIRED_OTP when OTP key is not in Redis', async () => {
    testApp.mockRedis.get.mockResolvedValue(null); // key absent → expired

    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/verify',
      payload: { phone: '+237612345678', code: '000000' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('EXPIRED_OTP');
  });

  it('returns 400 INVALID_OTP when code does not match stored value', async () => {
    testApp.mockRedis.get
      .mockResolvedValueOnce('654321') // stored OTP code
      .mockResolvedValueOnce('0');     // attempt counter

    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/phone/verify',
      payload: { phone: '+237612345678', code: '000000' }, // wrong code
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_OTP');
  });
});

// ----------------------------------------------------------------
// POST /api/v1/auth/logout — protected route
// ----------------------------------------------------------------

describe('POST /api/v1/auth/logout', () => {
  it('returns 401 when no Authorization header is present', async () => {
    // refresh_token must be in the body (schema required) — authGuard runs after
    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refresh_token: 'any-placeholder' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the access token is malformed', async () => {
    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: 'Bearer not.a.valid.jwt' },
      payload: { refresh_token: 'any-placeholder' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 200 when a valid access token is provided', async () => {
    // logout() calls jwt.verify on refresh_token — an invalid value is silently
    // ignored (idempotent revocation), so the handler still returns 200.
    const token = signJwt(testApp.app, 42);
    const res = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${token}` },
      payload: { refresh_token: 'already-expired-or-invalid' },
    });

    expect(res.statusCode).toBe(200);
  });
});
