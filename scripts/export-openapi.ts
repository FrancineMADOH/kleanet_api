/**
 * Export OpenAPI schema to docs/openapi.json.
 *
 * Usage:  npm run export:openapi
 *
 * The generated file can be used to:
 * - Generate Dart/Flutter HTTP clients with openapi-generator
 * - Validate the schema with: npx @apidevtools/swagger-cli validate docs/openapi.json
 * - Import into Postman or Insomnia
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Set minimal env vars so config validation passes before app is built
process.env['NODE_ENV'] ??= 'development';
process.env['ODOO_URL'] ??= 'http://localhost:8069';
process.env['ODOO_DB'] ??= 'odoo';
process.env['ODOO_USER'] ??= 'admin';
process.env['ODOO_PASSWORD'] ??= 'admin';
process.env['JWT_SECRET'] ??= 'export-script-placeholder-secret-key-32c';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';

async function main(): Promise<void> {
  // Dynamic import after env vars are set (config validates at module load)
  const { buildApp } = await import('../src/app');

  const app = buildApp();
  await app.ready();

  const schema = app.swagger();

  mkdirSync(join(process.cwd(), 'docs'), { recursive: true });
  const outPath = join(process.cwd(), 'docs', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(schema, null, 2));

  const pathCount = Object.keys((schema as Record<string, unknown>).paths ?? {}).length;
  console.log(`OpenAPI schema written to ${outPath}`);
  console.log(`Routes: ${pathCount} paths`);

  await app.close();
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
