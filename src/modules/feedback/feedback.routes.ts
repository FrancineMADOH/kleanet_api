import type { FastifyInstance } from 'fastify';
import { submitFeedbackSchema } from './feedback.schema';
import { submitFeedback, isFeedbackServiceError } from './feedback.service';
import { authGuard } from '../../shared/guards/auth.guard';
import type { SubmitFeedbackInput } from './feedback.types';

/**
 * Feedback routes plugin — mounts under /api/v1/feedback.
 *
 * POST / — submit feedback for a delivered order (JWT required)
 */
async function feedbackRoutes(fastify: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // POST /
  // ----------------------------------------------------------------
  fastify.post<{ Body: SubmitFeedbackInput }>(
    '/',
    { preHandler: authGuard, schema: submitFeedbackSchema },
    async (request, reply) => {
      try {
        const result = await submitFeedback(fastify, request.user.partner_id, request.body);
        return reply.code(201).send(result);
      } catch (err) {
        if (isFeedbackServiceError(err)) {
          return reply.code(err.status).send({
            error: err.code,
            message: err.message,
          });
        }
        // Re-throw infrastructure errors (Odoo failures) to Fastify's 500 handler
        throw err;
      }
    },
  );
}

// Routes plugins must NOT be wrapped with fastify-plugin — fp() disables scope
// isolation, which causes the prefix option to be ignored in Fastify 5.
export default feedbackRoutes;
