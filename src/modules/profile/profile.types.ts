export interface DeliveryLocation {
  latitude: number;
  longitude: number;
}

export interface Profile {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  /** null when partner_latitude and partner_longitude are both 0 (Odoo default). */
  delivery_location: DeliveryLocation | null;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export interface UpdateLocationInput {
  latitude: number;
  longitude: number;
}
