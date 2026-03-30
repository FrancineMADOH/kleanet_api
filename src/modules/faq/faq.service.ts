import type { FastifyInstance } from 'fastify';
import type { OdooRecord } from '../../shared/odoo/odoo.types';
import type { FaqCategory, FaqItem } from './faq.types';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/**
 * Redis cache key for the FAQ list.
 * Exported so catalog.service.ts can include it in invalidateCache().
 */
export const CACHE_KEY_FAQ = 'catalog:faq';

/** Cache TTL in seconds (1 hour). */
const FAQ_CACHE_TTL = 3600;

// ----------------------------------------------------------------
// Public service function
// ----------------------------------------------------------------

/**
 * Returns published customer-facing FAQs, served from Redis cache when available.
 *
 * All FAQs are cached under a single key. If `categoryId` is provided the list
 * is filtered in memory after the cache read — avoids per-category cache keys
 * and keeps invalidation simple (one key to delete).
 */
export async function listFaq(
  fastify: FastifyInstance,
  categoryId?: number,
): Promise<FaqItem[]> {
  let items: FaqItem[];

  const cached = await fastify.redis.get(CACHE_KEY_FAQ);

  if (cached !== null) {
    fastify.log.info('catalog:faq cache hit');
    items = JSON.parse(cached) as FaqItem[];
  } else {
    const records = await fastify.odoo.searchRead(
      'laundry.faq',
      [
        ['is_published', '=', true],
        ['audience', '=', 'customer'],
      ],
      ['id', 'name', 'question', 'answer', 'category_id', 'sequence'],
    );

    items = records.map(mapToFaqItem);
    await fastify.redis.set(CACHE_KEY_FAQ, JSON.stringify(items), 'EX', FAQ_CACHE_TTL);
    fastify.log.info('catalog:faq cache miss — fetched from Odoo');
  }

  if (categoryId !== undefined) {
    return items.filter((item) => item.category?.id === categoryId);
  }

  return items;
}

// ----------------------------------------------------------------
// Private helpers
// ----------------------------------------------------------------

/**
 * Maps an Odoo laundry.faq record to a FaqItem.
 */
function mapToFaqItem(rec: OdooRecord): FaqItem {
  return {
    id: rec.id,
    reference: rec.name as string,
    question: rec.question as string,
    answer: rec.answer as string,
    category: mapCategory(rec.category_id),
    sequence: rec.sequence as number,
  };
}

/**
 * Maps an Odoo Many2one category_id value ([id, name] or false) to FaqCategory | null.
 */
function mapCategory(value: unknown): FaqCategory | null {
  if (Array.isArray(value) && value.length === 2) {
    return { id: value[0] as number, name: value[1] as string };
  }
  return null;
}
