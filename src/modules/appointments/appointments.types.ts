export type AppointmentStatus =
  | 'requested'
  | 'scheduled'
  | 'on_route'
  | 'arrived'
  | 'done'
  | 'cancelled';

export interface AppointmentSummary {
  id: number;
  /** Odoo sequence reference, e.g. "APT/2026/00001". */
  reference: string;
  type: 'pickup' | 'delivery';
  /** Mapped from Odoo 'state' field. */
  status: AppointmentStatus;
  scheduled_from: string; // ISO 8601
  scheduled_to?: string;  // ISO 8601
}

export interface CreateAppointmentInput {
  type: 'pickup' | 'delivery';
  /** ISO 8601 datetime — must be at least 2 hours from now. */
  scheduled_from: string;
  scheduled_to?: string;
  /** IDs of laundry orders to link — must all belong to the authenticated partner. */
  order_ids?: number[];
  subscription_id?: number;
  notes?: string;
}
