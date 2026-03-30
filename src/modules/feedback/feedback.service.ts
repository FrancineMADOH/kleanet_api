import type { FastifyInstance } from 'fastify';
import type { OdooRecord } from '../../shared/odoo/odoo.types';
import type { FeedbackResult, SubmitFeedbackInput } from './feedback.types';

// ----------------------------------------------------------------
// Validation error type
// ----------------------------------------------------------------

/** Structured error thrown by service functions for known business rule violations. */
export interface FeedbackServiceError {
  code: string;
  status: number;
  message: string;
}

/**
 * Type guard — returns true if the thrown value is a FeedbackServiceError.
 * Used by route handlers to distinguish business errors from infrastructure errors.
 */
export function isFeedbackServiceError(
  err: unknown,
): err is FeedbackServiceError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'status' in err &&
    'message' in err
  );
}

// ----------------------------------------------------------------
// Public service function
// ----------------------------------------------------------------

/**
 * Submits customer feedback for a delivered order.
 *
 * Throws FeedbackServiceError (403) if the order does not belong to the partner.
 * Throws FeedbackServiceError (400) if the order is not in delivered state.
 * Throws FeedbackServiceError (409) if feedback already exists for the order.
 */
export async function submitFeedback(
  fastify: FastifyInstance,
  partnerId: number,
  input: SubmitFeedbackInput,
): Promise<FeedbackResult> {
  await validateOrderOwnershipAndState(fastify, partnerId, input.order_id);
  await checkNoExistingFeedback(fastify, input.order_id);

  const newId = await createFeedbackRecord(fastify, partnerId, input);

  const feedbacks = await fastify.odoo.searchRead(
    'laundry.feedback',
    [['id', '=', newId]],
    ['id', 'name', 'order_id', 'rating', 'would_recommend', 'comment', 'date_submitted'],
  );

  return mapToFeedbackResult(feedbacks[0]);
}

// ----------------------------------------------------------------
// Private — validation helpers
// ----------------------------------------------------------------

/**
 * Verifies the order belongs to the partner and is in delivered state.
 * Uses a single searchRead with partner_id filter to avoid data leakage (returns 403 for both
 * "not found" and "wrong owner" so the caller cannot enumerate other partners' orders).
 */
async function validateOrderOwnershipAndState(
  fastify: FastifyInstance,
  partnerId: number,
  orderId: number,
): Promise<void> {
  const orders = await fastify.odoo.searchRead(
    'laundry.order',
    [['id', '=', orderId], ['partner_id', '=', partnerId]],
    ['id', 'state'],
  );

  if (orders.length === 0) {
    throw {
      code: 'FORBIDDEN',
      status: 403,
      message: 'Order not found or does not belong to you.',
    } satisfies FeedbackServiceError;
  }

  if (orders[0].state !== 'delivered') {
    throw {
      code: 'ORDER_NOT_DELIVERED',
      status: 400,
      message: 'Feedback can only be submitted for delivered orders.',
    } satisfies FeedbackServiceError;
  }
}

/**
 * Throws FeedbackServiceError (409) if feedback already exists for this order.
 */
async function checkNoExistingFeedback(
  fastify: FastifyInstance,
  orderId: number,
): Promise<void> {
  const existing = await fastify.odoo.searchRead(
    'laundry.feedback',
    [['order_id', '=', orderId]],
    ['id'],
    { limit: 1 },
  );

  if (existing.length > 0) {
    throw {
      code: 'ALREADY_REVIEWED',
      status: 409,
      message: 'You have already submitted feedback for this order.',
    } satisfies FeedbackServiceError;
  }
}

/**
 * Builds the create payload and calls odoo.create.
 * Returns the new record id.
 */
async function createFeedbackRecord(
  fastify: FastifyInstance,
  partnerId: number,
  input: SubmitFeedbackInput,
): Promise<number> {
  const vals: Record<string, unknown> = {
    partner_id: partnerId,
    order_id: input.order_id,
    rating: input.rating,
    channel: 'app',
  };

  if (input.comment) {
    vals.comment = input.comment;
  }
  if (typeof input.would_recommend === 'boolean') {
    vals.would_recommend = input.would_recommend;
  }

  return fastify.odoo.create('laundry.feedback', vals);
}

// ----------------------------------------------------------------
// Private — mapper + helpers
// ----------------------------------------------------------------

/**
 * Maps an Odoo laundry.feedback record to a FeedbackResult.
 */
function mapToFeedbackResult(rec: OdooRecord): FeedbackResult {
  return {
    id: rec.id,
    reference: rec.name as string,
    order_id: mapM2oId(rec.order_id) ?? (rec.order_id as number),
    rating: rec.rating as number,
    would_recommend:
      typeof rec.would_recommend === 'boolean' ? rec.would_recommend : undefined,
    comment: rec.comment ? (rec.comment as string) : undefined,
    submitted_at: mapDatetime(rec.date_submitted)!,
  };
}

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
 * Converts an Odoo Datetime string ("YYYY-MM-DD HH:MM:SS", UTC) to ISO 8601.
 * Returns undefined if the field is not set (Odoo returns false).
 */
function mapDatetime(value: unknown): string | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }
  return new Date(value + 'Z').toISOString();
}
