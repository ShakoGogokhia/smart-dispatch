export type Paginated<T> = {
  current_page: number;
  data: T[];
  per_page: number;
  total: number;
};

export type UserLite = {
  id: number;
  name: string;
  email: string;
  language?: "en" | "ka";
  roles?: string[];
};

export type MarketLite = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
};

export type OrderItem = {
  id: number;
  item_id?: number | null;
  name: string;
  sku?: string | null;
  qty: number;
  unit_price: number | string;
  line_total: number | string;
};

export type DriverLite = {
  id: number;
  status: string;
  user?: UserLite;
  latest_ping?: {
    id: number;
    lat: string;
    lng: string;
    created_at?: string;
    updated_at?: string;
  } | null;
};

export type Order = {
  id: number;
  code: string;
  status: string;
  pickup_address?: string | null;
  dropoff_address: string | null;
  dropoff_lat: string;
  dropoff_lng: string;
  created_at: string;
  market_accepted_at?: string | null;
  ready_for_pickup_at?: string | null;
  accepted_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  promo_code?: string | null;
  notes?: string | null;
  subtotal?: number | string;
  discount_total?: number | string;
  total?: number | string;
  market?: MarketLite | null;
  customer?: UserLite | null;
  assigned_driver_id?: number | null;
  offered_driver_id?: number | null;
  assigned_driver?: DriverLite | null;
  offered_driver?: DriverLite | null;
  items?: OrderItem[];
};

export type RouteStop = {
  id: number;
  route_plan_id: number;
  order_id: number;
  sequence: number;
  status: string;
};

export type RoutePlan = {
  id: number;
  driver_id: number;
  route_date: string;
  status: string;
  stops?: RouteStop[];
};

export type LocationPing = {
  id: number;
  driver_id: number;
  lat: string;
  lng: string;
  created_at: string;
};
