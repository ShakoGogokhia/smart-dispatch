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

export type Vehicle = {
  id: number;
  name: string;
  type?: string | null;
  capacity?: number | string | null;
  max_stops?: number | null;
};

export type DriverLite = {
  id: number;
  status: string;
  balance?: number | string;
  total_earned?: number | string;
  user?: UserLite;
  vehicle?: Vehicle | null;
  active_shift?: { id: number; started_at: string } | null;
  latest_ping?: {
    id?: number;
    lat: string | number;
    lng: string | number;
    created_at?: string;
    updated_at?: string;
  } | null;
};

export type MarketLite = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  is_active?: boolean;
  owner_user_id?: number;
  owner?: UserLite;
  logo_url?: string | null;
};

export type OrderItem = {
  id?: number;
  item_id?: number | null;
  name: string;
  sku?: string | null;
  qty: number;
  unit_price?: number | string;
  line_total?: number | string;
  price?: number | string;
};

export type Order = {
  id: number;
  code: string;
  status: string;
  pickup_address?: string | null;
  dropoff_address: string | null;
  dropoff_lat: string | number;
  dropoff_lng: string | number;
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
  timeline?: Array<{ key: string; label: string; at?: string | null; done: boolean }>;
  eta_summary?: {
    estimated_delivery_at?: string | null;
    promised_at?: string | null;
    is_late?: boolean;
  };
  delivery_proof?: {
    note?: string | null;
    photo_url?: string | null;
  };
  driver_compensation?: {
    distance_km?: number | string | null;
    weather_multiplier?: number | string | null;
    earning_amount?: number | string | null;
    weather_condition?: string | null;
  };
  rating_summary?: {
    rating?: number | null;
    feedback?: string | null;
  };
  actions?: {
    can_cancel?: boolean;
    can_rate?: boolean;
    can_reorder?: boolean;
  };
};

export type RouteStop = {
  id: number;
  route_plan_id?: number;
  order_id: number;
  sequence: number;
  status: string;
  eta?: string | null;
  dispatch_score?: number;
  order?: { code: string; dropoff_address?: string | null };
};

export type RoutePlan = {
  id: number;
  driver_id: number;
  route_date: string;
  status: string;
  planned_distance_km?: string | number | null;
  planned_duration_min?: string | number | null;
  driver?: DriverLite;
  stops?: RouteStop[];
};

export type LiveLocation = {
  driver_id: number;
  lat: number | string;
  lng: number | string;
  created_at?: string;
  updated_at?: string;
};

export type LivePayload = {
  locations?: LiveLocation[];
  since?: string;
};

export type AnalyticsSummary = {
  range: { from: string; to: string };
  orders: {
    total: number;
    delivered: number;
    failed: number;
    cancelled: number;
  };
  routes_planned: number;
  on_time_rate?: number | null;
  trend?: Array<{ date: string; total: number; delivered: number; cancelled: number }>;
  by_market?: Array<{ market_id: number; market_name: string; market_code: string; orders: number; delivered: number; revenue: number }>;
  by_driver?: Array<{ driver_id: number; driver_name: string; delivered: number; failed: number; assigned: number; avg_rating: number }>;
  funnel?: Record<string, number>;
};

export type LiveAlertPayload = {
  late_orders: Order[];
  idle_drivers: DriverLite[];
  stale_tracking: DriverLite[];
};

export type LiveHistoryPayload = {
  since?: string;
  history: Array<{
    driver_id: number;
    points: Array<{
      lat: number | string;
      lng: number | string;
      created_at?: string;
    }>;
  }>;
};

export type Item = {
  id: number;
  market_id?: number;
  name: string;
  sku: string;
  price: string | number;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: string | number;
  stock_qty: number;
  is_active: boolean;
};

export type PromoCode = {
  id: number;
  market_id: number;
  code: string;
  type: "percent" | "fixed";
  value: string | number;
  starts_at?: string | null;
  ends_at?: string | null;
  max_uses?: number | null;
  uses: number;
  is_active: boolean;
};

export type DriverFeed = {
  driver: {
    id: number;
    status: string;
    active_shift?: { id: number; started_at: string } | null;
    latest_ping?: { lat: number | string; lng: number | string; updated_at?: string } | null;
  };
  offered_orders: Order[];
  assigned_orders: Order[];
};

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  language?: "en" | "ka";
  roles: string[];
};
