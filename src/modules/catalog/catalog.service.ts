import type { FastifyInstance } from 'fastify';
import type { CatalogResponse, GarmentType, PricingRule, SubscriptionPlan } from './catalog.types';
import { CACHE_KEY_FAQ } from '../faq/faq.service';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Redis key for the cached catalogue (garment types + pricing rules). */
const CACHE_KEY_SERVICES = 'catalog:services';

/** Redis key for the cached subscription plans. */
const CACHE_KEY_PLANS = 'catalog:plans';

/** Cache TTL in seconds (1 hour). */
const CATALOG_CACHE_TTL = 3600;

// ----------------------------------------------------------------
// Service functions
// ----------------------------------------------------------------

/**
 * Returns garment types and pricing rules, served from Redis cache when available.
 *
 * Cache miss → fetches both models from Odoo in parallel, caches the result
 * for CATALOG_CACHE_TTL seconds, then returns it.
 */
export async function getCatalog(fastify: FastifyInstance): Promise<CatalogResponse> {
  const cached = await fastify.redis.get(CACHE_KEY_SERVICES);

  if (cached !== null) {
    fastify.log.info('catalog:services cache hit');
    return JSON.parse(cached) as CatalogResponse;
  }

  const [garmentRecords, pricingRecords] = await Promise.all([
    fastify.odoo.searchRead(
      'laundry.garment.type',
      [],
      ['id', 'name', 'default_material_id', 'is_special_item'],
    ),
    fastify.odoo.searchRead(
      'laundry.pricing.rule',
      [],
      ['id', 'mode', 'material_id', 'garment_type_id', 'price', 'currency_id'],
    ),
  ]);

  const garment_types: GarmentType[] = garmentRecords.map((rec) => ({
    id: rec.id as number,
    name: rec.name as string,
    default_material: mapM2o(rec.default_material_id),
    is_special_item: rec.is_special_item as boolean,
  }));

  const pricing_rules: PricingRule[] = pricingRecords.map((rec) => ({
    id: rec.id as number,
    mode: rec.mode as 'per_kg' | 'per_piece',
    material_name: mapM2o(rec.material_id),
    garment_type_name: mapM2o(rec.garment_type_id),
    price: rec.price as number,
    currency: mapM2o(rec.currency_id) ?? 'XAF',
  }));

  const result: CatalogResponse = {
    garment_types,
    pricing_rules,
    cached_at: new Date().toISOString(),
  };

  await fastify.redis.set(CACHE_KEY_SERVICES, JSON.stringify(result), 'EX', CATALOG_CACHE_TTL);
  fastify.log.info('catalog:services cache miss — fetched from Odoo');

  return result;
}

/**
 * Returns active subscription plans, served from Redis cache when available.
 *
 * Cache miss → fetches active plans from Odoo, caches for CATALOG_CACHE_TTL seconds.
 */
export async function getPlans(fastify: FastifyInstance): Promise<SubscriptionPlan[]> {
  const cached = await fastify.redis.get(CACHE_KEY_PLANS);

  if (cached !== null) {
    fastify.log.info('catalog:plans cache hit');
    return JSON.parse(cached) as SubscriptionPlan[];
  }

  const records = await fastify.odoo.searchRead(
    'laundry.subscription.plan',
    [['active', '=', true]],
    [
      'id', 'name', 'segment', 'billing_cycle',
      'included_weight_kg', 'included_pieces', 'included_pickups_per_week',
      'recurring_fee', 'overage_price_per_kg', 'currency_id',
      'description', 'target_label', 'is_recommended',
    ],
  );

  const plans: SubscriptionPlan[] = records.map((rec) => ({
    id: rec.id as number,
    name: rec.name as string,
    segment: rec.segment as 'residential' | 'business',
    billing_cycle: rec.billing_cycle as 'monthly' | 'weekly',
    included_weight_kg: rec.included_weight_kg as number,
    included_pieces: rec.included_pieces as number,
    included_pickups_per_week: rec.included_pickups_per_week as number,
    recurring_fee: rec.recurring_fee as number,
    overage_price_per_kg: rec.overage_price_per_kg as number,
    currency: mapM2o(rec.currency_id) ?? 'XAF',
    // Odoo returns false for empty Text/Char fields — normalise to undefined
    description: (rec.description as string | false) || undefined,
    target_label: (rec.target_label as string | false) || undefined,
    is_recommended: rec.is_recommended as boolean,
  }));

  await fastify.redis.set(CACHE_KEY_PLANS, JSON.stringify(plans), 'EX', CATALOG_CACHE_TTL);
  fastify.log.info('catalog:plans cache miss — fetched from Odoo');

  return plans;
}

/**
 * Deletes both catalogue cache keys from Redis.
 *
 * Idempotent — safe to call even when keys do not exist.
 */
export async function invalidateCache(fastify: FastifyInstance): Promise<void> {
  await fastify.redis.del(CACHE_KEY_SERVICES, CACHE_KEY_PLANS, CACHE_KEY_FAQ);
  fastify.log.info('catalog cache invalidated (services, plans, faq)');
}

// ----------------------------------------------------------------
// Private helpers
// ----------------------------------------------------------------

/**
 * Extracts the display name from an Odoo Many2one field value.
 *
 * Odoo JSON-RPC returns Many2one fields as `[id, "name"]` tuples,
 * or `false` when the field is empty. Returns the name, or undefined.
 */
function mapM2o(value: unknown): string | undefined {
  if (Array.isArray(value) && value.length >= 2) {
    return String(value[1]);
  }
  return undefined;
}
