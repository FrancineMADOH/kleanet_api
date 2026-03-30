import type { FastifyInstance } from 'fastify';
import type { OdooRecord } from '../../shared/odoo/odoo.types';
import type {
  AppointmentStatus,
  AppointmentSummary,
  CreateAppointmentInput,
} from './appointments.types';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Minimum hours between now and scheduled_from when booking an appointment. */
const MIN_HOURS_AHEAD = 2;

// ----------------------------------------------------------------
// Validation error type
// ----------------------------------------------------------------

/** Structured error thrown by service functions for known business rule violations. */
export interface AppointmentValidationError {
  code: string;
  status: number;
  message: string;
}

/**
 * Type guard — returns true if the thrown value is an AppointmentValidationError.
 * Used by route handlers to distinguish business errors from infrastructure errors.
 */
export function isAppointmentValidationError(
  err: unknown,
): err is AppointmentValidationError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'status' in err &&
    'message' in err
  );
}

// ----------------------------------------------------------------
// Service functions
// ----------------------------------------------------------------

/**
 * Creates a new appointment in Odoo after validating timing and order ownership.
 *
 * Throws AppointmentValidationError (not Error) for business rule violations —
 * the route handler catches these and maps them to 400/403 responses.
 */
export async function createAppointment(
  fastify: FastifyInstance,
  partnerId: number,
  input: CreateAppointmentInput,
): Promise<AppointmentSummary> {
  validateScheduledFrom(input.scheduled_from);

  if (input.order_ids && input.order_ids.length > 0) {
    await validateOrderOwnership(fastify, partnerId, input.order_ids);
  }

  const newId = await buildAndCreate(fastify, partnerId, input);

  const appts = await fastify.odoo.searchRead(
    'laundry.appointment',
    [['id', '=', newId]],
    ['id', 'name', 'type', 'state', 'scheduled_from', 'scheduled_to'],
  );

  return mapToAppointmentSummary(appts[0]);
}

/**
 * Returns all appointments belonging to the authenticated partner, newest first.
 */
export async function listAppointments(
  fastify: FastifyInstance,
  partnerId: number,
): Promise<AppointmentSummary[]> {
  const records = await fastify.odoo.searchRead(
    'laundry.appointment',
    [['partner_id', '=', partnerId]],
    ['id', 'name', 'type', 'state', 'scheduled_from', 'scheduled_to'],
    { order: 'scheduled_from desc' },
  );

  return records.map(mapToAppointmentSummary);
}

// ----------------------------------------------------------------
// Private — validation helpers
// ----------------------------------------------------------------

/**
 * Validates that scheduled_from is a valid date and at least MIN_HOURS_AHEAD from now.
 * Throws AppointmentValidationError if the check fails.
 */
function validateScheduledFrom(scheduledFromIso: string): void {
  const scheduledDate = new Date(scheduledFromIso);

  if (isNaN(scheduledDate.getTime())) {
    throw {
      code: 'INVALID_DATE',
      status: 400,
      message: 'scheduled_from is not a valid ISO 8601 datetime.',
    } satisfies AppointmentValidationError;
  }

  const minDate = new Date(Date.now() + MIN_HOURS_AHEAD * 60 * 60 * 1000);

  if (scheduledDate < minDate) {
    throw {
      code: 'TOO_SOON',
      status: 400,
      message: `Appointment must be scheduled at least ${MIN_HOURS_AHEAD} hours in advance.`,
    } satisfies AppointmentValidationError;
  }
}

/**
 * Verifies that every id in orderIds belongs to the given partner.
 * Throws AppointmentValidationError (403) if any order is not found for that partner.
 */
async function validateOrderOwnership(
  fastify: FastifyInstance,
  partnerId: number,
  orderIds: number[],
): Promise<void> {
  const found = await fastify.odoo.searchRead(
    'laundry.order',
    [['id', 'in', orderIds], ['partner_id', '=', partnerId]],
    ['id'],
  );

  if (found.length !== orderIds.length) {
    throw {
      code: 'FORBIDDEN',
      status: 403,
      message: 'One or more orders do not belong to you.',
    } satisfies AppointmentValidationError;
  }
}

/**
 * Builds the Odoo create payload and calls odoo.create.
 * Returns the new record id.
 */
async function buildAndCreate(
  fastify: FastifyInstance,
  partnerId: number,
  input: CreateAppointmentInput,
): Promise<number> {
  const vals: Record<string, unknown> = {
    partner_id: partnerId,
    type: input.type,
    scheduled_from: isoToOdoo(input.scheduled_from),
  };

  if (input.scheduled_to) {
    vals.scheduled_to = isoToOdoo(input.scheduled_to);
  }
  if (input.notes) {
    vals.notes = input.notes;
  }
  if (input.subscription_id) {
    vals.subscription_id = input.subscription_id;
  }
  if (input.order_ids && input.order_ids.length > 0) {
    // Many2many command 6: replace all linked records with the provided list
    vals.order_ids = [[6, 0, input.order_ids]];
  }

  return fastify.odoo.create('laundry.appointment', vals);
}

// ----------------------------------------------------------------
// Private — mapper + date helpers
// ----------------------------------------------------------------

/**
 * Maps an Odoo laundry.appointment record to an AppointmentSummary.
 */
function mapToAppointmentSummary(rec: OdooRecord): AppointmentSummary {
  return {
    id: rec.id,
    reference: rec.name as string,
    type: rec.type as 'pickup' | 'delivery',
    status: rec.state as AppointmentStatus,
    // scheduled_from is required=True in Odoo — non-null assertion is safe
    scheduled_from: mapDatetime(rec.scheduled_from)!,
    scheduled_to: mapDatetime(rec.scheduled_to),
  };
}

/**
 * Converts an Odoo Datetime string ("YYYY-MM-DD HH:MM:SS", UTC) to ISO 8601.
 * Returns undefined if the field is not set (Odoo returns false).
 */
function mapDatetime(value: unknown): string | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }
  // Odoo Datetime strings are UTC but lack the 'Z' suffix — append it before parsing.
  return new Date(value + 'Z').toISOString();
}

/**
 * Converts an ISO 8601 string to Odoo Datetime format ("YYYY-MM-DD HH:MM:SS").
 *
 * Normalizes through Date to handle any valid ISO 8601 variant
 * (with/without milliseconds, with/without timezone offset).
 */
function isoToOdoo(isoString: string): string {
  return new Date(isoString).toISOString().replace('T', ' ').substring(0, 19);
}
