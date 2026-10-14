import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import { api } from "@/src/lib/api";

export type LiveLocationStatus = "off" | "starting" | "on" | "denied" | "unavailable";

/** How often the driver's position is sent while online. */
export const PING_INTERVAL_MS = 10_000;

type Coords = { latitude: number; longitude: number; speed?: number | null; heading?: number | null };

/**
 * While `enabled` (driver is online), follows the phone's GPS and sends the latest position to the
 * backend every 10 seconds (`POST /api/tracking/ping`) — no manual pings needed. Dispatch uses it to
 * show the driver on the map and to send the next order once they're ~500 m from the current customer.
 */
export function useLiveLocation(enabled: boolean, onSent?: () => void) {
  const [status, setStatus] = useState<LiveLocationStatus>("off");
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const latest = useRef<Coords | null>(null);
  const onSentRef = useRef(onSent);
  onSentRef.current = onSent;

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const send = async () => {
      const coords = latest.current;
      if (!coords || cancelled) return;
      try {
        await api.post("/api/tracking/ping", {
          lat: coords.latitude,
          lng: coords.longitude,
          speed: coords.speed != null && coords.speed >= 0 ? coords.speed : undefined,
          heading: coords.heading != null && coords.heading >= 0 ? coords.heading : undefined,
        });
        if (!cancelled) setLastSentAt(Date.now());
        onSentRef.current?.();
      } catch {
        // Network hiccup: the next tick tries again.
      }
    };

    (async () => {
      setStatus("starting");
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted") {
          setStatus("denied");
          return;
        }

        // Keep the freshest position in a ref; the 10 s timer sends whatever is newest.
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 5 },
          (position) => {
            latest.current = position.coords;
          },
        );
        if (cancelled) {
          subscription.remove();
          return;
        }

        const first = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (cancelled) return;
        if (first) latest.current = first.coords;
        setStatus("on");
        void send();
        timer = setInterval(() => void send(), PING_INTERVAL_MS);
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      if (timer) clearInterval(timer);
    };
  }, [enabled]);

  return { status, lastSentAt };
}
