import type { FastifyInstance } from 'fastify';
import { createOrderSchema, listOrdersSchema, getOrderSchema } from './orders.schema';
import { createOrder, listOrders, getOrder } from './orders.service';
import { authGuard } from '../../shared/guards/auth.guard';
import type { CreateOrderInput, ListOrdersQuery } from './orders.types';

/**
 * Orders routes plugin — mounts under the prefix registered in app.ts (/api/v1/orders).
 *
 * POST /    — create a laundry order (JWT required)
 * GET  /    — list my orders, paginated (JWT required)
 * GET  /:id — get order detail (JWT required, 404 if not owner)
 */
async function ordersRoutes(fastify: FastifyInstance): Promise<void> {
  // ----------------------------------------------------------------
  // POST /
  // ----------------------------------------------------------------
  fastify.post<{ Body: CreateOrderInput }>(
    '/',
    { preHandler: authGuard, schema: createOrderSchema },
    async (request, reply) => {
      const result = await createOrder(fastify, request.user.partner_id, request.body);
      return reply.code(200).send(result);
    },
  );

  // ----------------------------------------------------------------
  // GET /
  // ----------------------------------------------------------------
  fastify.get<{ Querystring: ListOrdersQuery }>(
    '/',
    { preHandler: authGuard, schema: listOrdersSchema },
    async (request, reply) => {
      const orders = await listOrders(fastify, request.user.partner_id, request.query);
      return reply.code(200).send(orders);
    },
  );

  // ----------------------------------------------------------------
  // GET /:id
  // ----------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: authGuard, schema: getOrderSchema },
    async (request, reply) => {
      const orderId = parseInt(request.params.id, 10);

      if (isNaN(orderId) || orderId <= 0) {
        return reply.code(400).send({
          error: 'INVALID_ORDER_ID',
          message: 'Order ID must be a positive integer.',
        });
      }

      const order = await getOrder(fastify, orderId, request.user.partner_id);

      if (order === null) {
        return reply.code(404).send({
          error: 'ORDER_NOT_FOUND',
          message: 'Order not found.',
        });
      }

      return reply.code(200).send(order);
    },
  );
}

// Routes plugins must NOT be wrapped with fastify-plugin — fp() disables scope
// isolation, which causes the prefix option to be ignored in Fastify 5.
export default ordersRoutes;
