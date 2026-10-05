import L from "leaflet";

/**
 * Round Leaflet marker colored with theme tokens (e.g. "bg-primary", "bg-success"),
 * so pins follow the active palette and light/dark mode.
 * Pass full Tailwind class names so they are picked up by the class scanner.
 */
export function makeDotIcon(colorClass: string, { size = 20, selected = false }: { size?: number; selected?: boolean } = {}) {
  return L.divIcon({
    className: "",
    html: `<span class="flex items-center justify-center rounded-full border-2 border-background shadow-md ${colorClass} ${selected ? "ring-4 ring-ring/40" : ""}" style="width:${size}px;height:${size}px"><span class="size-1.5 rounded-full bg-background"></span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}
