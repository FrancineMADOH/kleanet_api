import type { FastifyInstance } from 'fastify';
import type { OdooRecord } from '../../shared/odoo/odoo.types';
import type {
  ActiveSubscription,
  SubscribeInput,
  SubscriptionState,
} from './subscription.types';

// ----------------------------------------------------------------
// Validation error type
// ----------------------------------------------------------------

/** Structured error thrown by service functions for known business rule violations. */
export interface SubscriptionServiceError {
  code: string;
  status: number;
  message: string;
}

/**
 * Type guard — returns true if the thrown value is a SubscriptionServiceError.
 * Used by route handlers to distinguish business errors from infrastructure errors.
 */
export function isSubscriptionServiceError(
  err: unknown,
): err is SubscriptionServiceError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'status' in err &&
    'message' in err
  );
}

// ----------------------------------------------------------------
// Public service functions
// ----------------------------------------------------------------

/**
 * Returns the active or paused subscription for the given partner.
 * Returns null if no such subscription exists.
 */
export async function getMySubscription(
  fastify: FastifyInstance,
  partnerId: number,
): Promise<ActiveSubscription | null> {
  const subs = await fastify.odoo.searchRead(
    'laundry.subscription',
    [['partner_id', '=', partnerId], ['state', 'in', ['active', 'paused']]],
    [
      'id', 'name', 'state', 'plan_id', 'billing_cycle',
      'start_date', 'end_date', 'included_weight_kg', 'included_pieces',
      'recurring_fee', 'overage_price_per_kg', 'currency_id',
      'period_weight_kg', 'remaining_weight_kg', 'orders_count',
    ],
    { limit: 1 },
  );

  if (subs.length === 0) {
    return null;
  }

  const sub = subs[0];
  const pickupsPerWeek = await fetchPickupsPerWeek(fastify, sub.plan_id);

  return mapToActiveSubscription(sub, pickupsPerWeek);
}

/**
 * Creates a new subscription for the given partner from the specified plan.
 *
 * Throws SubscriptionServiceError (409) if an active/paused subscription already exists.
 * Throws SubscriptionServiceError (404) if the plan does not exist or is inactive.
 */
export async function subscribe(
  fastify: FastifyInstance,
  partnerId: number,
  input: SubscribeInput,
): Promise<ActiveSubscription> {
  await checkNoExistingSubscription(fastify, partnerId);

  const plan = await fetchActivePlan(fastify, input.plan_id);

  await fastify.odoo.create('laundry.subscription', {
    partner_id: partnerId,
    plan_id: input.plan_id,
    billing_cycle: plan.billing_cycle,
    included_weight_kg: plan.included_weight_kg,
    included_pieces: plan.included_pieces,
    recurring_fee: plan.recurring_fee,
    overage_price_per_kg: plan.overage_price_per_kg,
  });

  // Re-fetch to include computed usage fields and the generated sequence name
  const created = await getMySubscription(fastify, partnerId);
  // Non-null assertion is safe: we just created the subscription above
  return created!;
}

// ----------------------------------------------------------------
// Private — validation helpers
// ----------------------------------------------------------------

/**
 * Throws SubscriptionServiceError (409) if the partner already has an
 * active or paused subscription.
 */
async function checkNoExistingSubscription(
  fastify: FastifyInstance,
  partnerId: number,
): Promise<void> {
  const existing = await fastify.odoo.searchRead(
    'laundry.subscription',
    [['partner_id', '=', partnerId], ['state', 'in', ['active', 'paused']]],
    ['id'],
    { limit: 1 },
  );

  if (existing.length > 0) {
    throw {
      code: 'ALREADY_SUBSCRIBED',
      status: 409,
      message: 'You already have an active or paused subscription.',
    } satisfies SubscriptionServiceError;
  }
}

/**
 * Fetches an active plan by id.
 * Throws SubscriptionServiceError (404) if not found or inactive.
 */
async function fetchActivePlan(
  fastify: FastifyInstance,
  planId: number,
): Promise<OdooRecord> {
  const plans = await fastify.odoo.searchRead(
    'laundry.subscription.plan',
    [['id', '=', planId], ['active', '=', true]],
    [
      'id', 'name', 'billing_cycle', 'included_weight_kg',
      'included_pieces', 'recurring_fee', 'overage_price_per_kg',
    ],
  );

  if (plans.length === 0) {
    throw {
      code: 'PLAN_NOT_FOUND',
      status: 404,
      message: 'Plan not found or inactive.',
    } satisfies SubscriptionServiceError;
  }

  return plans[0];
}

/**
 * Fetches `included_pickups_per_week` from the plan linked to a subscription.
 * Returns 0 if the plan cannot be resolved.
 */
async function fetchPickupsPerWeek(
  fastify: FastifyInstance,
  planM2o: unknown,
): Promise<number> {
  const planId = mapM2oId(planM2o);
  if (!planId) {
    return 0;
  }

  const plans = await fastify.odoo.searchRead(
    'laundry.subscription.plan',
    [['id', '=', planId]],
    ['included_pickups_per_week'],
  );

  return plans.length > 0 ? ((plans[0].included_pickups_per_week as number) || 0) : 0;
}

// ----------------------------------------------------------------
// Private — mapper
// ----------------------------------------------------------------

/**
 * Maps an Odoo laundry.subscription record to an ActiveSubscription.
 */
function mapToActiveSubscription(
  rec: OdooRecord,
  includedPickupsPerWeek: number,
): ActiveSubscription {
  return {
    id: rec.id,
    reference: rec.name as string,
    plan_name: mapM2oName(rec.plan_id) ?? '',
    billing_cycle: rec.billing_cycle as 'monthly' | 'weekly',
    included_weight_kg: (rec.included_weight_kg as number) || 0,
    included_pieces: (rec.included_pieces as number) || 0,
    included_pickups_per_week: includedPickupsPerWeek,
    recurring_fee: (rec.recurring_fee as number) || 0,
    overage_price_per_kg: (rec.overage_price_per_kg as number) || 0,
    currency: mapM2oName(rec.currency_id) ?? 'XAF',
    start_date: rec.start_date as string,
    end_date: rec.end_date ? (rec.end_date as string) : undefined,
    state: rec.state as SubscriptionState,
    usage: {
      orders_this_period: (rec.orders_count as number) || 0,
      weight_used_kg: (rec.period_weight_kg as number) || 0,
      remaining_weight_kg: (rec.remaining_weight_kg as number) || 0,
    },
  };
}

// ----------------------------------------------------------------
// Private — Many2one helpers
// ----------------------------------------------------------------

/**
 * Extracts the numeric id from an Odoo Many2one value ([id, name] or false).
 * Returns undefined if the field is not set.
 */
function mapM2oId(value: unknown): number | undefined {
  if (Array.isArray(value) && value.length === 2) {
    return value[0] as number;
  }
  return undefined;
}

/**
 * Extracts the display name from an Odoo Many2one value ([id, name] or false).
 * Returns undefined if the field is not set.
 */
function mapM2oName(value: unknown): string | undefined {
  if (Array.isArray(value) && value.length === 2) {
    return value[1] as string;
  }
  return undefined;
}
