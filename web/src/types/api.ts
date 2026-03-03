export type Paginated<T> = {
  current_page: number;
  data: T[];
  per_page: number;
  total: number;
};

export type Order = {
  id: number;
  code: string;
  status: string;
  dropoff_address: string | null;
  dropoff_lat: string;
  dropoff_lng: string;
  created_at: string;
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