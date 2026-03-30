import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOtp, storeOtp, verifyOtp } from '../../src/shared/otp/otp.service';
import { OTP_MAX_ATTEMPTS } from '../../src/config/constants';

// ----------------------------------------------------------------
// generateOtp
// ----------------------------------------------------------------

describe('generateOtp', () => {
  it('returns a 6-character string', () => {
    expect(generateOtp().length).toBe(6);
  });

  it('contains only digits', () => {
    expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('pads values below 100000 with leading zeros', () => {
    // Run multiple times to increase probability of hitting a sub-6-digit number
    for (let i = 0; i < 20; i++) {
      expect(generateOtp().length).toBe(6);
    }
  });
});

// ----------------------------------------------------------------
// verifyOtp — the four required cases
// ----------------------------------------------------------------

describe('verifyOtp', () => {
  const phone = '+237612345678';
  const correctCode = '123456';

  // Minimal redis mock — only the methods used by verifyOtp
  let redis: {
    get: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    incr: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    redis = {
      get: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1),
    };
  });

  it('returns "valid" when code matches and attempts are within limit', async () => {
    redis.get
      .mockResolvedValueOnce(correctCode)  // otp key → stored code
      .mockResolvedValueOnce('0');          // attempts key → 0 attempts so far

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await verifyOtp(redis as any, phone, correctCode);

    expect(result).toBe('valid');
    // OTP must be deleted after successful verification (single-use)
    expect(redis.del).toHaveBeenCalledOnce();
  });

  it('returns "expired" when OTP key is absent from Redis', async () => {
    redis.get.mockResolvedValueOnce(null); // key not found → expired or never sent

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await verifyOtp(redis as any, phone, correctCode);

    expect(result).toBe('expired');
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('returns "invalid" when code does not match and increments attempt counter', async () => {
    redis.get
      .mockResolvedValueOnce('654321')  // stored code (different from what we send)
      .mockResolvedValueOnce('1');       // attempts key → 1 attempt

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await verifyOtp(redis as any, phone, '000000');

    expect(result).toBe('invalid');
    expect(redis.incr).toHaveBeenCalledOnce();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('returns "max_attempts" when attempt counter has reached the limit', async () => {
    redis.get
      .mockResolvedValueOnce(correctCode)            // stored code exists
      .mockResolvedValueOnce(String(OTP_MAX_ATTEMPTS)); // attempts = max

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await verifyOtp(redis as any, phone, '000000');

    expect(result).toBe('max_attempts');
    // Should NOT increment further or delete — just refuse
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// storeOtp — stores code + resets attempt counter
// ----------------------------------------------------------------

describe('storeOtp', () => {
  it('calls redis.set twice — once for code, once for attempt counter', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await storeOtp(redis as any, '+237612345678', '987654');

    expect(redis.set).toHaveBeenCalledTimes(2);
  });

  it('stores the code as-is (no hashing at this layer)', async () => {
    const redis = { set: vi.fn().mockResolvedValue('OK') };
    const code = '555000';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await storeOtp(redis as any, '+237612345678', code);

    // First call should store the plain code
    const firstCallArgs = redis.set.mock.calls[0];
    expect(firstCallArgs[1]).toBe(code);
  });
});
