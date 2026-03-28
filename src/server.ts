import 'dotenv/config';
import { buildApp } from './app';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = '0.0.0.0';

/**
 * Entry point — builds the Fastify app and starts listening.
 * Exits the process with code 1 if the server fails to start.
 */
async function start(): Promise<void> {
  const fastify = buildApp();

  try {
    await fastify.listen({ port: PORT, host: HOST });
  } catch (err) {
    fastify.log.error(err, 'Server failed to start');
    process.exit(1);
  }
}

start();
