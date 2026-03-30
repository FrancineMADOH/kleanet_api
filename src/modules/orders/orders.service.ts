import type { FastifyInstance } from 'fastify';
import type { OdooRecord, OdooDomain } from '../../shared/odoo/odoo.types';
import type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderDetail,
  OrderLine,
  OrderStatus,
  OrderSummary,
} from './orders.types';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Default number of orders returned per page. */
const DEFAULT_PAGE_SIZE = 10;

/** Hard cap on orders per page — enforced in service even if schema allows it. */
const MAX_PAGE_SIZE = 50;

// ----------------------------------------------------------------
// Status mappings
// ----------------------------------------------------------------

/** Maps Odoo order state to the API's OrderStatus string. */
const ODOO_TO_API_STATUS: Record<string, OrderStatus> = {
  draft: 'pending',
  received: 'received',
  in_progress: 'processing',
  ready: 'ready_for_pickup',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

/** Maps the API's OrderStatus string to the Odoo order state (for domain filtering). */
const API_TO_ODOO_STATUS: Record<OrderStatus, string> = {
  pending: 'draft',
  received: 'received',
  processing: 'in_progress',
  ready_for_pickup: 'ready',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

// ----------------------------------------------------------------
// Service functions
// ----------------------------------------------------------------

/**
 * Creates a new laundry order in Odoo with the provided lines.
 *
 * partner_id is always sourced from the authenticated JWT — never from user input.
 * Odoo computes unit_price and subtotal server-side via _compute_prices.
 */
export async function createOrder(
  fastify: FastifyInstance,
  partnerId: number,
  input: CreateOrderInput,
): Promise<OrderDetail> {
  const lineIds = input.lines.map((line) => [
    0,
    0,
    {
      garment_type_id: line.garment_type_id,
      ...(line.material_id !== undefined && { material_id: line.material_id }),
      quantity: line.quantity ?? 1,
      weight_kg: line.weight_kg ?? 0,
    },
  ]);

  const orderVals: Record<string, unknown> = {
    partner_id: partnerId,
    line_ids: lineIds,
  };

  if (input.notes) {
    orderVals.notes = input.notes;
  }
  if (input.subscription_id) {
    orderVals.subscription_id = input.subscription_id;
  }
  if (input.delivery_location) {
    orderVals.delivery_latitude = input.delivery_location.latitude;
    orderVals.delivery_longitude = input.delivery_location.longitude;
  }

  const newId = await fastify.odoo.create('laundry.order', orderVals);

  // Re-fetch via getOrder to return a fully-populated OrderDetail.
  // Safe cast: we just created with this partnerId so getOrder cannot return null.
  return (await getOrder(fastify, newId, partnerId)) as OrderDetail;
}

/**
 * Returns a paginated list of orders belonging to the authenticated partner.
 *
 * Optionally filtered by API status. Sorted by creation date descending.
 */
export async function listOrders(
  fastify: FastifyInstance,
  partnerId: number,
  query: ListOrdersQuery,
): Promise<OrderSummary[]> {
  const domain: OdooDomain = [['partner_id', '=', partnerId]];

  if (query.status) {
    domain.push(['state', '=', API_TO_ODOO_STATUS[query.status]]);
  }

  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const records = await fastify.odoo.searchRead(
    'laundry.order',
    domain,
    ['id', 'name', 'state', 'amount_total', 'currency_id', 'total_pieces', 'date_received', 'date_ready'],
    { limit, offset: (page - 1) * limit, order: 'create_date desc' },
  );

  return records.map(mapToOrderSummary);
}

/**
 * Returns the full detail for a single order, including its lines.
 *
 * Returns null if the order does not exist or belongs to a different partner —
 * the route handler maps null to a 404 (no data leakage via 403).
 */
export async function getOrder(
  fastify: FastifyInstance,
  orderId: number,
  partnerId: number,
): Promise<OrderDetail | null> {
  const orders = await fastify.odoo.searchRead(
    'laundry.order',
    [['id', '=', orderId], ['partner_id', '=', partnerId]],
    [
      'id', 'name', 'state', 'amount_total', 'currency_id', 'total_pieces',
      'date_received', 'date_ready', 'notes', 'subscription_id',
      'delivery_latitude', 'delivery_longitude',
    ],
  );

  if (orders.length === 0) {
    return null;
  }

  const lines = await fastify.odoo.searchRead(
    'laundry.order.line',
    [['order_id', '=', orderId]],
    ['id', 'garment_type_id', 'material_id', 'quantity', 'weight_kg', 'unit_price', 'subtotal'],
  );

  return mapToOrderDetail(orders[0], lines);
}

// ----------------------------------------------------------------
// Private mapper helpers
// ----------------------------------------------------------------

/**
 * Maps an Odoo laundry.order record to an OrderSummary.
 */
function mapToOrderSummary(rec: OdooRecord): OrderSummary {
  return {
    id: rec.id,
    reference: rec.name as string,
    status: ODOO_TO_API_STATUS[rec.state as string] ?? 'pending',
    amount_total: rec.amount_total as number,
    currency: mapM2oName(rec.currency_id) ?? 'XAF',
    total_pieces: rec.total_pieces as number,
    date_received: mapDatetime(rec.date_received),
    date_ready: mapDatetime(rec.date_ready),
  };
}

/**
 * Maps an Odoo laundry.order record and its lines to an OrderDetail.
 */
function mapToOrderDetail(rec: OdooRecord, lineRecords: OdooRecord[]): OrderDetail {
  const lat = rec.delivery_latitude as number;
  const lng = rec.delivery_longitude as number;

  return {
    ...mapToOrderSummary(rec),
    lines: lineRecords.map(mapToOrderLine),
    notes: (rec.notes as string | false) || undefined,
    subscription_id: mapM2oId(rec.subscription_id),
    // 0.0 is Odoo's default for unset Float fields — treat as absent
    delivery_latitude: lat || undefined,
    delivery_longitude: lng || undefined,
    tracking_url: `/laundry/order/${rec.id}/status`,
  };
}

/**
 * Maps an Odoo laundry.order.line record to an OrderLine.
 */
function mapToOrderLine(rec: OdooRecord): OrderLine {
  return {
    id: rec.id,
    garment_type_id: mapM2oId(rec.garment_type_id),
    garment_type_name: mapM2oName(rec.garment_type_id),
    material_id: mapM2oId(rec.material_id),
    material_name: mapM2oName(rec.material_id),
    quantity: rec.quantity as number,
    weight_kg: rec.weight_kg as number,
    unit_price: rec.unit_price as number,
    subtotal: rec.subtotal as number,
  };
}

/**
 * Extracts the numeric id from an Odoo Many2one value ([id, name] or false).
 */
function mapM2oId(value: unknown): number | undefined {
  if (Array.isArray(value) && value.length >= 1) {
    return value[0] as number;
  }
  return undefined;
}

/**
 * Extracts the display name from an Odoo Many2one value ([id, name] or false).
 */
function mapM2oName(value: unknown): string | undefined {
  if (Array.isArray(value) && value.length >= 2) {
    return String(value[1]);
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
  // Odoo Datetime strings are UTC but lack the 'Z' suffix — append it before parsing.
  return new Date(value + 'Z').toISOString();
}
