import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { JwtPayload } from '../../types/fastify';

/**
 * Fastify preHandler guard — verifies the Bearer JWT on protected routes.
 *
 * Attaches the decoded payload to `request.user` on success.
 * Responds with 401 if the header is missing, the token is invalid,
 * or the token has expired.
 */
export const authGuard: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or missing token' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = await request.server.jwt.verify<JwtPayload>(token);
    request.user = payload;
  } catch {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or missing token' });
  }
};
