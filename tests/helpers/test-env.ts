/**
 * Sets all required environment variables before any test file imports
 * src/config/env.ts (which calls process.exit(1) on invalid env).
 *
 * Vitest runs setupFiles synchronously before resolving the module graph
 * of each test file — so these assignments are guaranteed to be in place.
 */
process.env['NODE_ENV'] = 'test';
process.env['ODOO_URL'] = 'http://localhost:8069';
process.env['ODOO_DB'] = 'odoo_test';
process.env['ODOO_USER'] = 'admin';
process.env['ODOO_PASSWORD'] = 'admin';
process.env['JWT_SECRET'] = 'test-secret-key-min-32-chars-xxxxxxxxxx';
process.env['JWT_EXPIRY'] = '30m';
process.env['REFRESH_EXPIRY'] = '30d';
process.env['REDIS_URL'] = 'redis://localhost:6379';
