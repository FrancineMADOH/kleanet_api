import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Odoo JSON-RPC connection
  ODOO_URL: z.string().url(),
  ODOO_DB: z.string().min(1),
  ODOO_USER: z.string().min(1),
  ODOO_PASSWORD: z.string().min(1),

  // JWT — secret enforced to at least 32 characters
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRY: z.string().default('30m'),
  REFRESH_EXPIRY: z.string().default('30d'),

  // Redis
  REDIS_URL: z.string().url(),

  // Optional — features are silently disabled when these are absent
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
});

/** TypeScript type inferred directly from the Zod schema. */
export type Config = z.infer<typeof envSchema>;

/**
 * Validates all environment variables against the schema at startup.
 * Prints a clear per-field error report and exits with code 1
 * if any required variable is missing or fails validation.
 */
function validateEnv(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n[kleanet-api] Invalid environment variables:\n');

    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || 'unknown';
      console.error(`  ✗ ${field}: ${issue.message}`);
    }

    console.error(
      '\nFix the above variables in your .env file and restart the server.\n',
    );
    process.exit(1);
  }

  return result.data;
}

/**
 * Parsed and fully typed environment configuration.
 * Guaranteed valid — the process exits before this is exported if not.
 */
export const config = validateEnv();
