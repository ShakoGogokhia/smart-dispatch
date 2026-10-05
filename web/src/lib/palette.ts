import { useSyncExternalStore } from 'react';

/** Keep in sync with the `data-palette` blocks in src/index.css. */
export const PALETTES = [
    { id: 'blue', label: 'Blue', h: 262, c: 0.2, l: 0.52, ld: 0.68 },
    { id: 'indigo', label: 'Indigo', h: 277, c: 0.2, l: 0.51, ld: 0.67 },
    { id: 'violet', label: 'Violet', h: 293, c: 0.22, l: 0.54, ld: 0.7 },
    { id: 'fuchsia', label: 'Fuchsia', h: 325, c: 0.24, l: 0.56, ld: 0.7 },
    { id: 'rose', label: 'Rose', h: 12, c: 0.21, l: 0.58, ld: 0.7 },
    { id: 'orange', label: 'Orange', h: 45, c: 0.19, l: 0.62, ld: 0.74 },
    { id: 'emerald', label: 'Emerald', h: 160, c: 0.14, l: 0.55, ld: 0.72 },
    { id: 'teal', label: 'Teal', h: 185, c: 0.12, l: 0.55, ld: 0.74 },
    { id: 'sky', label: 'Sky', h: 235, c: 0.15, l: 0.58, ld: 0.74 },
    { id: 'zinc', label: 'Neutral', h: 270, c: 0, l: 0.24, ld: 0.92 },
    { id: 'midnight', label: 'Midnight', h: 262, c: 0.19, l: 0.52, ld: 0.7 },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export const PALETTE_STORAGE_KEY = 'palette';
const DEFAULT_PALETTE: PaletteId = 'blue';
const listeners = new Set<() => void>();

function isPalette(value: unknown): value is PaletteId {
    return PALETTES.some((p) => p.id === value);
}

function read(): PaletteId {
    try {
        const saved = window.localStorage.getItem(PALETTE_STORAGE_KEY);
        if (isPalette(saved)) return saved;
    } catch {
        /* ignore */
    }
    return DEFAULT_PALETTE;
}

export function applyPalette(id: PaletteId) {
    const root = document.documentElement;
    if (id === DEFAULT_PALETTE) delete root.dataset.palette;
    else root.dataset.palette = id;
}

export function setPalette(id: PaletteId) {
    try {
        window.localStorage.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
        /* ignore */
    }
    applyPalette(id);
    listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
    listeners.add(fn);
    const onStorage = (event: StorageEvent) => {
        if (event.key !== PALETTE_STORAGE_KEY) return;
        applyPalette(read());
        fn();
    };
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(fn);
        window.removeEventListener('storage', onStorage);
    };
}

export function usePalette() {
    const palette = useSyncExternalStore(subscribe, read, () => DEFAULT_PALETTE);
    return { palette, setPalette };
}

/** Swatch color for a palette in the given mode. */
export function swatchColor(p: (typeof PALETTES)[number], dark: boolean) {
    return `oklch(${dark ? p.ld : p.l} ${p.c} ${p.h})`;
}
