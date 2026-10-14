import type { Order } from "@/types/api";

/** The single next thing the driver should do, computed by the backend. */
export type DriverStep = "offer" | "to_pickup" | "waiting_ready" | "pickup" | "to_dropoff" | "handover" | "done";

/** Order as returned by the driver feed (decorated with step + pickup coordinates). */
export type DriverOrder = Order & {
  driver_step?: DriverStep;
  is_ready_for_pickup?: boolean;
  arrived_at_pickup_at?: string | null;
  arrived_at_dropoff_at?: string | null;
  pickup_lat?: number | string | null;
  pickup_lng?: number | string | null;
};

export type DriverPing = { lat: number | string; lng: number | string; updated_at?: string } | null;

export type DriverFeed = {
  driver: {
    id: number;
    status: string;
    balance?: number | string;
    total_earned?: number | string;
    active_shift?: { id: number; started_at: string } | null;
    latest_ping?: DriverPing;
    transactions?: Array<{
      id: number;
      amount: number | string;
      distance_km?: number | string | null;
      weather_condition?: string | null;
      created_at?: string;
      description?: string | null;
    }>;
  };
  offered_orders: DriverOrder[];
  assigned_orders: DriverOrder[];
};

/** Endpoint suffix for each step's primary action (null = nothing to do but wait). */
export const STEP_ACTION: Record<DriverStep, string | null> = {
  offer: null,
  to_pickup: "arrived-pickup",
  waiting_ready: null,
  pickup: "picked-up",
  to_dropoff: "arrived-dropoff",
  handover: "delivered",
  done: null,
};

/** Short label for compact cards. */
export const STEP_SHORT_LABEL: Record<DriverStep, string> = {
  offer: "Offer",
  to_pickup: "Go to market",
  waiting_ready: "Waiting at market",
  pickup: "Ready to pick up",
  to_dropoff: "Go to customer",
  handover: "Hand over",
  done: "Done",
};

/** Fallback when the feed predates `driver_step`. */
export function resolveStep(order: DriverOrder): DriverStep {
  if (order.driver_step) return order.driver_step;
  if (order.status === "OFFERED") return "offer";
  if (order.status === "ASSIGNED") {
    if (!order.arrived_at_pickup_at) return "to_pickup";
    return order.ready_for_pickup_at ? "pickup" : "waiting_ready";
  }
  if (order.status === "PICKED_UP") return order.arrived_at_dropoff_at ? "handover" : "to_dropoff";
  return "done";
}
