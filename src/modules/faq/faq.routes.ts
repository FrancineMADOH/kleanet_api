import type { FastifyInstance } from 'fastify';
import { listFaqSchema } from './faq.schema';
import { listFaq } from './faq.service';
import type { ListFaqQuery } from './faq.types';

/**
 * FAQ routes plugin — mounts under /api/v1/faq.
 *
 * GET / — list published customer FAQs (public, no auth required)
 */
async function faqRoutes(fastify: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // GET /
  // ----------------------------------------------------------------
  fastify.get<{ Querystring: ListFaqQuery }>(
    '/',
    { schema: listFaqSchema },
    async (request) => {
      return listFaq(fastify, request.query.category_id);
    },
  );
}

// Routes plugins must NOT be wrapped with fastify-plugin — fp() disables scope
// isolation, which causes the prefix option to be ignored in Fastify 5.
export default faqRoutes;
