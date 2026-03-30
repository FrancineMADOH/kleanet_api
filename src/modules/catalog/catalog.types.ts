/** A laundry garment type from the Odoo catalogue. */
export interface GarmentType {
  id: number;
  name: string;
  /** Default material name, extracted from Many2one — absent if not set. */
  default_material?: string;
  is_special_item: boolean;
}

/** A laundry pricing rule from the Odoo catalogue. */
export interface PricingRule {
  id: number;
  mode: 'per_kg' | 'per_piece';
  /** Material name, extracted from Many2one — absent for generic per_kg rules. */
  material_name?: string;
  /** Garment type name, extracted from Many2one — absent for generic rules. */
  garment_type_name?: string;
  price: number;
  currency: string;
}

/** Full catalogue response returned by GET /api/v1/catalog/services. */
export interface CatalogResponse {
  garment_types: GarmentType[];
  pricing_rules: PricingRule[];
  /** ISO 8601 timestamp of when this data was last fetched from Odoo. */
  cached_at?: string;
}

/** A subscription plan from the Odoo catalogue. */
export interface SubscriptionPlan {
  id: number;
  name: string;
  segment: 'residential' | 'business';
  billing_cycle: 'monthly' | 'weekly';
  included_weight_kg: number;
  included_pieces: number;
  included_pickups_per_week: number;
  recurring_fee: number;
  overage_price_per_kg: number;
  currency: string;
  description?: string;
  target_label?: string;
  is_recommended: boolean;
}
