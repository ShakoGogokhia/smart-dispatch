import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

export type LiveLocationStatus = "off" | "starting" | "on" | "denied" | "unavailable";

/** How often the driver's position is sent while online. */
export const PING_INTERVAL_MS = 10_000;

/**
 * While `enabled` (driver is online), follows the browser's geolocation and sends the latest position
 * every 10 seconds (`POST /api/tracking/ping`) — same as the mobile app, no manual pings needed.
 */
export function useLiveLocation(enabled: boolean, onSent?: () => void) {
  const [status, setStatus] = useState<LiveLocationStatus>("starting");
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const latest = useRef<GeolocationCoordinates | null>(null);
  const onSentRef = useRef(onSent);

  useEffect(() => {
    onSentRef.current = onSent;
  }, [onSent]);

  useEffect(() => {
    if (!enabled || !supported) return;

    let cancelled = false;

    const send = async () => {
      const coords = latest.current;
      if (!coords || cancelled) return;
      try {
        await api.post("/api/tracking/ping", {
          lat: coords.latitude,
          lng: coords.longitude,
          speed: coords.speed ?? undefined,
          heading: coords.heading ?? undefined,
        });
        onSentRef.current?.();
      } catch {
        // Network hiccup: the next tick tries again.
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const first = latest.current === null;
        latest.current = position.coords;
        if (!cancelled) setStatus("on");
        if (first) void send();
      },
      (error) => {
        if (!cancelled) setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    const timer = window.setInterval(() => void send(), PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [enabled, supported]);

  return { status: !enabled ? ("off" as const) : !supported ? ("unavailable" as const) : status };
}
