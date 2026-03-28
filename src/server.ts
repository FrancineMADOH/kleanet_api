import 'dotenv/config';
import { config } from './config/env';
import { buildApp } from './app';

const HOST = '0.0.0.0';

/**
 * Entry point — validates env vars, builds the Fastify app, and starts
 * listening. Exits with code 1 if the server fails to bind to the port.
 */
async function start(): Promise<void> {
  const fastify = buildApp();

  try {
    await fastify.listen({ port: config.PORT, host: HOST });
  } catch (err) {
    fastify.log.error(err, 'Server failed to start');
    process.exit(1);
  }
}

start();
