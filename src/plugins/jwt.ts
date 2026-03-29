import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config/env';

/**
 * Registers @fastify/jwt with the app secret and default sign options.
 *
 * Wrapped with fastify-plugin so `fastify.jwt` is available outside
 * this plugin's encapsulation scope (i.e. in route handlers and guards).
 */
async function jwtPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRY,
    },
  });
}

export default fp(jwtPlugin, { name: 'jwt' });
