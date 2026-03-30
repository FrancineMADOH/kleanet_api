export type SubscriptionState = 'active' | 'paused' | 'cancelled';

export interface SubscriptionUsage {
  /** Number of orders placed during the current billing period. */
  orders_this_period: number;
  /** Total weight (kg) used during the current billing period. */
  weight_used_kg: number;
  /** Remaining weight (kg) before overage pricing kicks in. */
  remaining_weight_kg: number;
}

export interface ActiveSubscription {
  id: number;
  reference: string;                 // laundry.subscription.name (e.g. "SUB/2026/00001")
  plan_name: string;                 // plan_id Many2one name
  billing_cycle: 'monthly' | 'weekly';
  included_weight_kg: number;
  included_pieces: number;
  included_pickups_per_week: number; // sourced from laundry.subscription.plan — not on subscription itself
  recurring_fee: number;
  overage_price_per_kg: number;
  currency: string;                  // currency_id[1] (e.g. "XAF")
  start_date: string;                // "YYYY-MM-DD"
  end_date?: string;                 // "YYYY-MM-DD"
  state: SubscriptionState;
  usage: SubscriptionUsage;
}

export interface SubscribeInput {
  plan_id: number;
}
