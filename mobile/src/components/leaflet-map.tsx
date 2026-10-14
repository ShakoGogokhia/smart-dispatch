import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";

import { usePreferences } from "@/src/providers/app-providers";

/**
 * Leaflet map rendered in a WebView — free OpenStreetMap/CARTO tiles, no API key needed
 * (react-native-maps requires a Google Maps key on Android). Free OpenStreetMap tiles; dark mode inverts them.
 * Markers and lines are pushed over the WebView bridge, so updates don't reload the map.
 */

export type MapMarker = {
  id: string | number;
  lat: number;
  lng: number;
  color: string;
  title?: string;
  description?: string;
  selected?: boolean;
};

export type MapPolyline = {
  id: string | number;
  points: { lat: number; lng: number }[];
  color: string;
  width?: number;
  /** Dashed line (e.g. the way to the pickup). */
  dashed?: boolean;
};

export type LeafletMapHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitToContent: () => void;
};

type Props = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  /** Zoom to show all markers/lines the first time they arrive. */
  fitOnLoad?: boolean;
  /** Re-fit whenever this value changes (e.g. when a road route arrives). */
  fitKey?: string | number;
  /** Extra room kept free when fitting (e.g. for overlays on top of the map), in px. */
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  onMarkerPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<LeafletMapHandle>;
};

// Free OpenStreetMap tiles, no API key. Dark mode reuses them with a CSS filter (see .sd-dark below).
const OSM_TILE = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap contributors",
};

function buildHtml(center: { lat: number; lng: number }, zoom: number, background: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${background}; }
  .sd-dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9); }
  .sd-dot { border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); box-sizing: border-box; }
  .leaflet-popup-content { margin: 8px 12px; font: 13px/1.35 -apple-system, system-ui, sans-serif; }
  .sd-title { font-weight: 600; }
  .sd-desc { color: #666; margin-top: 2px; font-size: 12px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${center.lat}, ${center.lng}], ${zoom});
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  var tiles = null;
  var markerLayer = L.layerGroup().addTo(map);
  var lineLayer = L.layerGroup().addTo(map);
  var lastFitKey = null;
  var currentPadding = null;

  function post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }

  function popupFor(m) {
    var root = document.createElement('div');
    if (m.title) { var t = document.createElement('div'); t.className = 'sd-title'; t.textContent = m.title; root.appendChild(t); }
    if (m.description) { var d = document.createElement('div'); d.className = 'sd-desc'; d.textContent = m.description; root.appendChild(d); }
    return root;
  }

  function fitToContent() {
    var bounds = L.latLngBounds([]);
    markerLayer.eachLayer(function (l) { bounds.extend(l.getLatLng()); });
    lineLayer.eachLayer(function (l) { bounds.extend(l.getBounds()); });
    var pad = currentPadding || { top: 32, right: 32, bottom: 32, left: 32 };
    if (bounds.isValid()) map.fitBounds(bounds, { paddingTopLeft: [pad.left, pad.top], paddingBottomRight: [pad.right, pad.bottom], maxZoom: 16 });
  }

  function update(state) {
    document.body.classList.toggle('sd-dark', !!state.dark);
    currentPadding = state.fitPadding || null;
    if (state.tile && (!tiles || tiles._url !== state.tile.url)) {
      if (tiles) map.removeLayer(tiles);
      tiles = L.tileLayer(state.tile.url, { attribution: state.tile.attribution, maxZoom: 19 }).addTo(map);
    }
    lineLayer.clearLayers();
    (state.polylines || []).forEach(function (p) {
      if (!p.points || p.points.length < 2) return;
      L.polyline(p.points.map(function (pt) { return [pt.lat, pt.lng]; }), { color: p.color, weight: p.width || 4, opacity: 0.9, dashArray: p.dashed ? '8 8' : null, lineCap: 'round', lineJoin: 'round' }).addTo(lineLayer);
    });
    markerLayer.clearLayers();
    (state.markers || []).forEach(function (m) {
      var size = m.selected ? 22 : 16;
      var icon = L.divIcon({
        className: '',
        html: '<div class="sd-dot" style="width:' + size + 'px;height:' + size + 'px;background:' + m.color + '"></div>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
      });
      var marker = L.marker([m.lat, m.lng], { icon: icon, zIndexOffset: m.selected ? 1000 : 0 }).addTo(markerLayer);
      if (m.title || m.description) marker.bindPopup(popupFor(m));
      marker.on('click', function () { post({ type: 'markerPress', id: String(m.id) }); });
      if (m.selected) marker.openPopup();
    });
    var fitKey = state.fitKey == null ? 'once' : String(state.fitKey);
    if (state.fitOnLoad && fitKey !== lastFitKey && ((state.markers || []).length || (state.polylines || []).length)) {
      lastFitKey = fitKey;
      fitToContent();
    }
  }

  function handle(raw) {
    try {
      var msg = JSON.parse(raw);
      if (msg.type === 'update') update(msg.state);
      else if (msg.type === 'flyTo') map.flyTo([msg.lat, msg.lng], msg.zoom || map.getZoom(), { duration: 0.6 });
      else if (msg.type === 'fit') fitToContent();
    } catch (e) { post({ type: 'error', message: String(e && e.message || e) }); }
  }

  document.addEventListener('message', function (e) { handle(e.data); });
  window.addEventListener('message', function (e) { handle(e.data); });
  post({ type: 'ready' });
</script>
</body>
</html>`;
}

export function LeafletMap({ center, zoom = 12, markers = [], polylines = [], fitOnLoad = false, fitKey, fitPadding, onMarkerPress, style, ref }: Props) {
  const { theme, colors } = usePreferences();
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // The page is built once; later changes go over the bridge so the map keeps its position.
  const [html] = useState(() => buildHtml(center, zoom, colors.muted));

  const send = useCallback((message: unknown) => {
    // postMessage reaches both document/window listeners on iOS and Android.
    webRef.current?.postMessage(JSON.stringify(message));
  }, []);

  const state = useMemo(
    () => ({ tile: OSM_TILE, dark: theme === "dark", markers, polylines, fitOnLoad, fitKey, fitPadding }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fitKey, fitOnLoad, markers, polylines, theme, JSON.stringify(fitPadding)],
  );

  useEffect(() => {
    if (ready) send({ type: "update", state });
  }, [ready, send, state]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (lat, lng, nextZoom) => send({ type: "flyTo", lat, lng, zoom: nextZoom }),
      fitToContent: () => send({ type: "fit" }),
    }),
    [send],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as { type: string; id?: string; message?: string };
        if (msg.type === "ready") setReady(true);
        else if (msg.type === "markerPress" && msg.id) onMarkerPress?.(msg.id);
        else if (msg.type === "error") console.warn("[leaflet-map]", (msg as { message?: string }).message);
      } catch {
        // Ignore malformed bridge messages.
      }
    },
    [onMarkerPress],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.muted }, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://smart-dispatch.local/" }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        style={[styles.web, { backgroundColor: colors.muted }]}
      />
      {!ready ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.loading]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  web: { flex: 1 },
  loading: { alignItems: "center", justifyContent: "center" },
});
