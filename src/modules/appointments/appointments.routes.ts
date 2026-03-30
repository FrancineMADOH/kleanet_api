import type { FastifyInstance } from 'fastify';
import { createAppointmentSchema, listAppointmentsSchema } from './appointments.schema';
import {
  createAppointment,
  listAppointments,
  isAppointmentValidationError,
} from './appointments.service';
import { authGuard } from '../../shared/guards/auth.guard';
import type { CreateAppointmentInput } from './appointments.types';

/**
 * Appointments routes plugin — mounts under /api/v1/appointments.
 *
 * POST / — create a pickup or delivery appointment (JWT required)
 * GET  / — list my appointments (JWT required)
 */
async function appointmentsRoutes(fastify: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // POST /
  // ----------------------------------------------------------------
  fastify.post<{ Body: CreateAppointmentInput }>(
    '/',
    { preHandler: authGuard, schema: createAppointmentSchema },
    async (request, reply) => {
      try {
        const result = await createAppointment(
          fastify,
          request.user.partner_id,
          request.body,
        );
        return reply.code(200).send(result);
      } catch (err) {
        if (isAppointmentValidationError(err)) {
          return reply.code(err.status).send({
            error: err.code,
            message: err.message,
          });
        }
        // Re-throw infrastructure errors (Odoo/Redis failures) to Fastify's 500 handler
        throw err;
      }
    },
  );

  // ----------------------------------------------------------------
  // GET /
  // ----------------------------------------------------------------
  fastify.get(
    '/',
    { preHandler: authGuard, schema: listAppointmentsSchema },
    async (request, reply) => {
      const appointments = await listAppointments(fastify, request.user.partner_id);
      return reply.code(200).send(appointments);
    },
  );
}

// Routes plugins must NOT be wrapped with fastify-plugin — fp() disables scope
// isolation, which causes the prefix option to be ignored in Fastify 5.
export default appointmentsRoutes;
