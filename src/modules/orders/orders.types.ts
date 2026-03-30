export type OrderStatus =
  | 'pending'
  | 'received'
  | 'processing'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled';

export interface OrderLine {
  id: number;
  garment_type_id?: number;
  garment_type_name?: string;
  material_id?: number;
  material_name?: string;
  quantity: number;
  weight_kg: number;
  unit_price: number;
  subtotal: number;
}

export interface OrderSummary {
  id: number;
  /** Odoo sequence reference, e.g. "KLA/2026/00001". */
  reference: string;
  status: OrderStatus;
  amount_total: number;
  currency: string;
  total_pieces: number;
  date_received?: string; // ISO 8601
  date_ready?: string;    // ISO 8601
}

export interface OrderDetail extends OrderSummary {
  lines: OrderLine[];
  notes?: string;
  subscription_id?: number;
  /** GPS latitude of the delivery address — absent if not set by the mobile app. */
  delivery_latitude?: number;
  /** GPS longitude of the delivery address — absent if not set by the mobile app. */
  delivery_longitude?: number;
  /** Public tracking URL, e.g. "/laundry/order/42/status". */
  tracking_url: string;
}

export interface CreateOrderLine {
  garment_type_id: number;
  material_id?: number;
  quantity?: number;
  weight_kg?: number;
}

export interface CreateOrderInput {
  lines: CreateOrderLine[];
  notes?: string;
  subscription_id?: number;
  delivery_location?: {
    latitude: number;
    longitude: number;
  };
}

export interface ListOrdersQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}
