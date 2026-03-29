import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { config } from '../config/env';

// ----------------------------------------------------------------
// TypeScript module augmentation — adds fastify.redis to FastifyInstance
// ----------------------------------------------------------------
declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

/**
 * Registers an ioredis client as `fastify.redis`.
 *
 * Pings Redis in the `onReady` hook — if the ping fails the server
 * refuses to start, preventing silent data-loss bugs at runtime.
 * Wrapped with fastify-plugin so `fastify.redis` is visible app-wide.
 */
async function redisPlugin(fastify: FastifyInstance): Promise<void> {
  const redis = new Redis(config.REDIS_URL, {
    // Prevent ioredis from retrying forever on startup failures
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redis.on('error', (err: Error) => {
    fastify.log.error({ err }, 'Redis client error');
  });

  fastify.decorate('redis', redis);

  // Fail fast at startup rather than silently losing OTP / session data
  fastify.addHook('onReady', async () => {
    try {
      await redis.connect();
      await redis.ping();
      fastify.log.info('Redis connection established');
    } catch (err) {
      fastify.log.error({ err }, 'Redis is unreachable — refusing to start');
      throw err;
    }
  });

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
}

export default fp(redisPlugin, { name: 'redis' });
