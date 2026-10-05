/**
 * Theme tokens — a port of the web app's `src/index.css` palette system.
 * Every token is derived from a few knobs (hue, tint, primary chroma/lightness) with the exact same
 * OKLCH formulas as the web, then converted to sRGB hex because React Native has no `oklch()`.
 * Keep PALETTES in sync with `web/src/lib/palette.ts`.
 */

export const PALETTES = [
  { id: "blue", label: "Blue", h: 262, c: 0.2, l: 0.52, ld: 0.68 },
  { id: "indigo", label: "Indigo", h: 277, c: 0.2, l: 0.51, ld: 0.67 },
  { id: "violet", label: "Violet", h: 293, c: 0.22, l: 0.54, ld: 0.7 },
  { id: "fuchsia", label: "Fuchsia", h: 325, c: 0.24, l: 0.56, ld: 0.7 },
  { id: "rose", label: "Rose", h: 12, c: 0.21, l: 0.58, ld: 0.7 },
  { id: "orange", label: "Orange", h: 45, c: 0.19, l: 0.62, ld: 0.74 },
  { id: "emerald", label: "Emerald", h: 160, c: 0.14, l: 0.55, ld: 0.72 },
  { id: "teal", label: "Teal", h: 185, c: 0.12, l: 0.55, ld: 0.74 },
  { id: "sky", label: "Sky", h: 235, c: 0.15, l: 0.58, ld: 0.74 },
  { id: "zinc", label: "Neutral", h: 270, c: 0, l: 0.24, ld: 0.92 },
  { id: "midnight", label: "Midnight", h: 262, c: 0.19, l: 0.52, ld: 0.7 },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_PALETTE: PaletteId = "blue";

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

type Rgb = [number, number, number];

function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const linear: Rgb = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];

  return linear.map((x) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  }) as Rgb;
}

function hex([r, g, b]: Rgb) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function ok(l: number, c: number, h: number) {
  return hex(oklchToRgb(l, c, h));
}

/** oklch color at `alpha` composited over another oklch color — keeps tokens opaque 6-digit hex. */
function okOver(fg: [number, number, number], alpha: number, bg: [number, number, number]) {
  const top = oklchToRgb(...fg);
  const bottom = oklchToRgb(...bg);
  return hex(top.map((v, i) => Math.round(v * alpha + bottom[i] * (1 - alpha))) as Rgb);
}

export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarBorder: string;
  sidebarAccent: string;
  overlay: string;
  shadow: string;
};

export function buildColors(paletteId: PaletteId, theme: ResolvedTheme): ThemeColors {
  const p = PALETTES.find((entry) => entry.id === paletteId) ?? PALETTES[0];
  const h = p.h;
  const t = paletteId === "zinc" ? 0 : paletteId === "midnight" ? 0.45 : 1;
  const pc = p.c;

  if (theme === "light") {
    const fg = ok(0.21, 0.03 * t, h);
    return {
      background: ok(0.985, 0.003 * t, h),
      foreground: fg,
      card: "#ffffff",
      cardForeground: fg,
      popover: "#ffffff",
      popoverForeground: fg,
      primary: ok(p.l, pc, h),
      primaryForeground: ok(0.985, 0, 0),
      secondary: ok(0.955, 0.01 * t, h),
      secondaryForeground: ok(0.28, 0.04 * t, h),
      muted: ok(0.96, 0.008 * t, h),
      mutedForeground: ok(0.52, 0.03 * t, h),
      accent: ok(0.94, 0.02 * t, h),
      accentForeground: ok(0.28, 0.06 * t, h),
      destructive: ok(0.577, 0.245, 27.325),
      destructiveForeground: ok(0.985, 0, 0),
      success: ok(0.627, 0.17, 149.2),
      successForeground: ok(0.985, 0, 0),
      warning: ok(0.795, 0.17, 70),
      warningForeground: ok(0.25, 0.05, 60),
      info: ok(0.62, 0.17, 245),
      infoForeground: ok(0.985, 0, 0),
      border: ok(0.9, 0.012 * t, h),
      input: ok(0.9, 0.012 * t, h),
      ring: ok(p.l + 0.04, pc, h),
      chart1: ok(p.l, pc, h),
      chart2: ok(0.65, 0.17, 150),
      chart3: ok(0.78, 0.17, 70),
      chart4: ok(0.6, 0.2, 20),
      chart5: ok(0.6, 0.18, 300),
      sidebar: ok(0.99, 0.002 * t, h),
      sidebarBorder: ok(0.92, 0.01 * t, h),
      sidebarAccent: ok(0.94, 0.02 * t, h),
      overlay: "#000000",
      shadow: ok(0.21, 0.03 * t, h),
    };
  }

  const midnight = paletteId === "midnight";
  const bgL = midnight ? 0.115 : 0.17;
  const bg: [number, number, number] = [bgL, 0.02 * t, h];
  const fg = ok(0.96, 0.008 * t, h);
  const primary = ok(p.ld, pc, h);

  return {
    background: ok(...bg),
    foreground: fg,
    card: ok(midnight ? 0.15 : 0.205, 0.024 * t, h),
    cardForeground: fg,
    popover: ok(midnight ? 0.17 : 0.22, 0.026 * t, h),
    popoverForeground: fg,
    primary,
    primaryForeground: ok(0.17, 0.03 * t, h),
    secondary: ok(midnight ? 0.21 : 0.26, 0.028 * t, h),
    secondaryForeground: ok(0.95, 0.01 * t, h),
    muted: ok(midnight ? 0.2 : 0.25, 0.026 * t, h),
    mutedForeground: ok(0.72, 0.025 * t, h),
    accent: ok(midnight ? 0.24 : 0.29, 0.04 * t, h),
    accentForeground: fg,
    destructive: ok(0.65, 0.2, 25),
    destructiveForeground: ok(0.985, 0, 0),
    success: ok(0.7, 0.16, 150),
    successForeground: ok(0.16, 0.03, 150),
    warning: ok(0.82, 0.16, 75),
    warningForeground: ok(0.22, 0.05, 60),
    info: ok(0.72, 0.13, 235),
    infoForeground: ok(0.16, 0.03, 240),
    border: okOver([0.8, 0.05 * t, h], 0.14, bg),
    input: okOver([0.8, 0.05 * t, h], 0.18, bg),
    ring: primary,
    chart1: primary,
    chart2: ok(0.72, 0.16, 150),
    chart3: ok(0.82, 0.16, 75),
    chart4: ok(0.68, 0.19, 20),
    chart5: ok(0.7, 0.17, 305),
    sidebar: ok(midnight ? 0.13 : 0.185, 0.022 * t, h),
    sidebarBorder: okOver([0.8, 0.05 * t, h], 0.1, bg),
    sidebarAccent: ok(midnight ? 0.21 : 0.265, 0.034 * t, h),
    overlay: "#000000",
    shadow: "#000000",
  };
}

/** Swatch color for a palette in the given mode (palette picker). */
export function swatchColor(p: (typeof PALETTES)[number], dark: boolean) {
  return ok(dark ? p.ld : p.l, p.c, p.h);
}

/** Add an alpha channel to a #rrggbb token: withAlpha(colors.primary, 0.1). */
export function withAlpha(color: string, alpha: number) {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color.slice(0, 7)}${a}`;
}

export const radius = { sm: 6, md: 8, lg: 10, xl: 14, full: 999 } as const;
