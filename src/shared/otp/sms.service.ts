import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../../config/env';

// africastalking has no official @types package — minimal local typing
// covers only what we use to avoid `any`.
interface AtSmsService {
  send(opts: { to: string[]; message: string; from?: string }): Promise<unknown>;
}
interface AtSdk {
  SMS: AtSmsService;
}

/** Common interface all SMS providers must implement. */
export interface SmsProvider {
  /**
   * Sends a text message to the given E.164 phone number.
   */
  send(phone: string, message: string): Promise<void>;
}

/**
 * Development SMS provider — logs the OTP to the terminal instead of
 * sending a real SMS. Used in `development` and `test` environments.
 */
export class MockSmsProvider implements SmsProvider {
  private readonly logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  /** Logs the OTP message to the server console (no real SMS sent). */
  async send(phone: string, message: string): Promise<void> {
    this.logger.info({ phone, message }, '[OTP DEV] SMS skipped — code logged here');
  }
}

/**
 * Production SMS provider — sends OTPs via Africa's Talking.
 *
 * Requires AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME in env.
 */
export class AfricasTalkingSmsProvider implements SmsProvider {
  private readonly sms: AtSmsService;

  constructor(apiKey: string, username: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AfricasTalking = require('africastalking') as (opts: {
      apiKey: string;
      username: string;
    }) => AtSdk;

    const sdk = AfricasTalking({ apiKey, username });
    this.sms = sdk.SMS;
  }

  /** Sends the OTP message via Africa's Talking to the given phone number. */
  async send(phone: string, message: string): Promise<void> {
    await this.sms.send({ to: [phone], message });
  }
}

/**
 * Factory — returns the correct SMS provider based on the current environment.
 *
 * Production requires AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME.
 * Development and test use MockSmsProvider (logs to terminal).
 */
export function getSmsProvider(
  env: Config['NODE_ENV'],
  logger: FastifyBaseLogger,
  cfg: Config,
): SmsProvider {
  if (env === 'production') {
    if (!cfg.AFRICASTALKING_API_KEY || !cfg.AFRICASTALKING_USERNAME) {
      throw new Error(
        'AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME are required in production',
      );
    }
    return new AfricasTalkingSmsProvider(cfg.AFRICASTALKING_API_KEY, cfg.AFRICASTALKING_USERNAME);
  }

  return new MockSmsProvider(logger);
}
