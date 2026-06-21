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
  phone?: string | null;
  address?: string | null;
  language?: "en" | "ka";
  roles?: string[];
};

export type NotificationRecord = {
  id: number;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at?: string | null;
};

export type TrackingPayload = {
  id: number;
  code: string;
  status: string;
  market?: MarketLite | null;
  pickup_address?: string | null;
  pickup_lat?: number | string | null;
  pickup_lng?: number | string | null;
  dropoff_address?: string | null;
  dropoff_lat?: number | string | null;
  dropoff_lng?: number | string | null;
  created_at?: string | null;
  eta_summary?: Order["eta_summary"];
  driver?: {
    id: number;
    name?: string | null;
    status?: string | null;
    latest_ping?: { lat: number | string; lng: number | string; updated_at?: string | null } | null;
  } | null;
  timeline?: Array<{ key: string; label: string; at?: string | null; done: boolean }>;
  events?: Array<{ id: number; type: string; payload?: Record<string, unknown> | null; created_at?: string | null }>;
};

export type DriverEarningsSummary = {
  range: { from: string; to: string };
  driver: DriverLite & { active_shift?: { id: number; started_at?: string | null } | null };
  totals: {
    balance: number | string;
    total_earned: number | string;
    period_earnings: number;
    period_deliveries: number;
    average_delivery_earning: number;
  };
  daily: Array<{ date: string; earnings: number; deliveries: number }>;
  transactions: Array<{
    id: number;
    type: string;
    amount: number | string;
    distance_km?: number | string | null;
    weather_multiplier?: number | string | null;
    weather_condition?: string | null;
    description?: string | null;
    created_at?: string | null;
    payout_status?: string;
    order?: { id: number; code: string; status?: string; dropoff_address?: string | null } | null;
  }>;
};

export type MarketDashboardSummary = {
  range: { from: string; to: string };
  market: MarketLite & { operating_status?: Record<string, unknown> };
  summary: {
    orders: number;
    revenue: number;
    pending_orders: number;
    ready_orders: number;
    delivered_orders: number;
    low_stock_count: number;
    pending_approvals: number;
  };
  top_items: Array<{ item_id?: number | null; name: string; qty_sold: number | string; revenue: number | string }>;
  stock_warnings: Array<{ id: number; name: string; sku: string; stock_qty: number; low_stock_threshold: number; is_active: boolean }>;
  promo_performance: Array<{ id: number; code: string; type: string; value: number | string; uses: number; max_uses?: number | null; is_active: boolean }>;
  rating_trends: {
    market_average?: number | null;
    market_count: number;
    item_average?: number | null;
    item_count: number;
  };
};

export type DispatchInsight = {
  order: Order;
  offer_timeout_seconds: number;
  offer_expires_at?: string | null;
  current_offer?: { driver_id: number; driver_name?: string | null } | null;
  declines: Array<{ driver_id: number; driver_name?: string | null; declined_at?: string | null }>;
  candidates: Array<{
    driver_id: number;
    driver_name: string;
    status: string;
    distance_km?: number | null;
    active_assigned_orders: number;
    remaining_capacity: number;
    declined: boolean;
    eligible: boolean;
    reasons: string[];
  }>;
  suggested_driver?: {
    driver_id: number;
    driver_name: string;
    status: string;
    distance_km?: number | null;
    active_assigned_orders: number;
    remaining_capacity: number;
    declined: boolean;
    eligible: boolean;
    reasons: string[];
  } | null;
};

export type ReviewRecord = {
  id: number;
  rating: number;
  comment?: string | null;
  created_at?: string;
  user?: { id: number; name: string } | null;
};

export type WorkflowApproval = {
  id: number;
  type: "market_creation" | "promo" | "badge" | "refund";
  status: "pending" | "approved" | "rejected";
  notes?: string | null;
  payload?: Record<string, unknown> | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  requester?: UserLite | null;
  reviewer?: UserLite | null;
  market?: MarketLite | null;
  order?: { id: number; code: string } | null;
  promo_code?: { id: number; code: string; market_id?: number | null } | null;
};

export type MarketLite = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  delivery_slots?: Array<{ label?: string; from?: string; to?: string } | string>;
};

export type OrderItem = {
  id: number;
  item_id?: number | null;
  name: string;
  sku?: string | null;
  qty: number;
  unit_price: number | string;
  line_total: number | string;
  ingredients?: Array<{ name: string; removable: boolean }> | null;
  removed_ingredients?: string[] | null;
  combo_offer?: { name: string; description?: string | null; combo_price: number | string } | null;
};

export type DriverLite = {
  id: number;
  status: string;
  balance?: number | string;
  total_earned?: number | string;
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
  offer_sent_at?: string | null;
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
    signature_name?: string | null;
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
    can_request_refund?: boolean;
  };
  receipt?: {
    number?: string | null;
    issued_at?: string | null;
    subtotal?: number | string;
    discount_total?: number | string;
    total?: number | string;
    payment?: {
      method?: string | null;
      status?: string | null;
      reference?: string | null;
      amount?: number | string | null;
      paid_at?: string | null;
      failed_at?: string | null;
      failure_reason?: string | null;
      refunded_amount?: number | string | null;
      refunded_at?: string | null;
    };
    items?: Array<{
      name: string;
      qty: number;
      unit_price?: number | string;
      line_total?: number | string;
      removed_ingredients?: string[];
      combo_offer?: { name: string; description?: string | null; combo_price: number | string } | null;
    }>;
  };
  refund_summary?: {
    status?: string | null;
    reason?: string | null;
    requested_at?: string | null;
  };
};

export type RouteStop = {
  id: number;
  route_plan_id: number;
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

export type LocationPing = {
  id: number;
  driver_id: number;
  lat: string;
  lng: string;
  created_at: string;
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
  category?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  variants?: Array<{ name: string; value: string; price_delta?: number | string }> | null;
  availability_schedule?: Array<{ day: string; from: string; to: string }> | null;
  ingredients?: Array<{ name: string; removable: boolean }> | null;
  combo_offers?: Array<{ name: string; description?: string | null; combo_price: number | string }> | null;
  price: string | number;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: string | number;
  stock_qty: number;
  low_stock_threshold?: number;
  is_low_stock?: boolean;
  is_active: boolean;
  review_summary?: {
    count?: number;
    average?: number | null;
  };
};

export type FavoritePayload = {
  markets: MarketLite[];
  items: Item[];
};
