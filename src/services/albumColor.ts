// src/services/albumColor.ts
//
// Shared album-colour cache.
// The Albums screen pre-computes the colour of every cover in the background;
// the Album Details screen then reads it synchronously, so its background
// colour is there on the very first frame.
import { getColors } from "react-native-image-colors";

// sentinel passed to the picker, ignored in the result
const FALLBACK_COLOR = "#010203";

// uri -> picked colour (null = nothing usable). Missing key = not computed yet.
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

// ── colour helpers ───────────────────────────────────────────────────
const hexToRgb = (hex: string): [number, number, number] | null => {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
    )
    .join("");

const luminance = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
};

const saturation = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  return max === 0 ? 0 : (max - min) / max;
};

/** Keep the colour dark enough so white text stays readable */
const toBackgroundTone = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lum = luminance(hex);
  const maxLum = 120;
  if (lum <= maxLum) return hex;
  const f = maxLum / lum;
  return rgbToHex(rgb[0] * f, rgb[1] * f, rgb[2] * f);
};

export const normalizeColorUri = (uri: string): string => {
  const u = String(uri);
  if (/^(file|content|https?|data):/i.test(u) || u.startsWith("asset:")) {
    return u;
  }
  return "file://" + u;
};

// ── public API ───────────────────────────────────────────────────────

/**
 * Synchronous read.
 *  string    → colour is ready
 *  null      → computed, but no usable colour
 *  undefined → not computed yet
 */
export function getCachedAlbumColor(
  uri?: string | null
): string | null | undefined {
  if (!uri) return undefined;
  return cache.get(normalizeColorUri(uri));
}

/** Compute (once) and cache the colour of one cover. */
export function resolveAlbumColor(uri: string): Promise<string | null> {
  const key = normalizeColorUri(uri);

  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const running = inflight.get(key);
  if (running) return running;

  const p = (async () => {
    let picked: string | null = null;
    try {
      const res: any = await getColors(key, {
        fallback: FALLBACK_COLOR,
        cache: true,
        key,
        quality: "high",
        pixelSpacing: 5,
      });

      let candidates: (string | undefined)[];
      if (res.platform === "android") {
        candidates = [
          res.dominant,
          res.vibrant,
          res.darkVibrant,
          res.muted,
          res.darkMuted,
          res.average,
        ];
      } else if (res.platform === "ios") {
        candidates = [res.background, res.primary, res.secondary, res.detail];
      } else {
        candidates = [res.dominant, res.vibrant, res.muted];
      }

      const valid = candidates.filter(
        (c): c is string =>
          !!c &&
          c.toLowerCase() !== FALLBACK_COLOR &&
          !!hexToRgb(c) &&
          luminance(c) > 20
      );

      let best = -1;
      for (const c of valid) {
        const s = saturation(c);
        if (s > best) {
          best = s;
          picked = c;
        }
      }
      picked = picked ? toBackgroundTone(picked) : null;
    } catch {
      picked = null;
    }

    cache.set(key, picked);
    inflight.delete(key);
    return picked;
  })();

  inflight.set(key, p);
  return p;
}

/** Warm the cache for many covers in the background (2 at a time). */
export function prefetchAlbumColors(uris: (string | undefined | null)[]) {
  const queue = Array.from(
    new Set(
      uris
        .filter((u): u is string => !!u)
        .map(normalizeColorUri)
        .filter((u) => !cache.has(u) && !inflight.has(u))
    )
  );
  if (queue.length === 0) return;

  const worker = async () => {
    while (queue.length > 0) {
      const next = queue.shift()!;
      await resolveAlbumColor(next);
    }
  };
  void worker();
  void worker();
}