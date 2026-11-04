// src/hooks/useId3Tags.ts
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

// ── Base64 decode ──────────────────────────────────────────────────
const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64_CHARS.length; i++) t[B64_CHARS.charCodeAt(i)] = i;
  return t;
})();

const base64ToBytes = (b64: string): Uint8Array => {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)] || 0;
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)] || 0;
    const c = B64_LOOKUP[clean.charCodeAt(i + 2)] || 0;
    const d = B64_LOOKUP[clean.charCodeAt(i + 3)] || 0;
    out[p++] = (a << 2) | (b >> 4);
    out[p++] = ((b & 15) << 4) | (c >> 2);
    out[p++] = ((c & 3) << 6) | d;
  }
  return out;
};

// ── ID3 helpers ────────────────────────────────────────────────────
const syncSafe = (b: Uint8Array, o: number) =>
  ((b[o] & 0x7f) << 21) |
  ((b[o + 1] & 0x7f) << 14) |
  ((b[o + 2] & 0x7f) << 7) |
  (b[o + 3] & 0x7f);

const decodeUtf16 = (b: Uint8Array, bigEndian: boolean): string => {
  let s = "";
  for (let i = 0; i + 1 < b.length; i += 2) {
    const code = bigEndian ? (b[i] << 8) | b[i + 1] : (b[i + 1] << 8) | b[i];
    s += String.fromCharCode(code);
  }
  return s;
};

const decodeUtf8 = (b: Uint8Array): string => {
  try {
    let pct = "";
    for (let i = 0; i < b.length; i++) {
      pct += "%" + (b[i] < 16 ? "0" : "") + b[i].toString(16);
    }
    return decodeURIComponent(pct);
  } catch {
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  }
};

const decodeId3Text = (b: Uint8Array, enc: number): string => {
  let s = "";
  if (enc === 1) {
    if (b[0] === 0xfe && b[1] === 0xff) s = decodeUtf16(b.subarray(2), true);
    else if (b[0] === 0xff && b[1] === 0xfe)
      s = decodeUtf16(b.subarray(2), false);
    else s = decodeUtf16(b, false);
  } else if (enc === 2) {
    s = decodeUtf16(b, true);
  } else if (enc === 3) {
    s = decodeUtf8(b);
  } else {
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  }
  return s
    .split("\u0000")
    .map((x) => x.trim())
    .filter(Boolean)
    .join(", ");
};

const readId3Frame = (
  b: Uint8Array,
  frameIds: string[],
): string | undefined => {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33)
    return undefined;
  const major = b[3];
  const flags = b[5];
  const tagSize = syncSafe(b, 6);
  let pos = 10;

  if (major >= 3 && (flags & 0x40) !== 0) {
    const ext =
      major === 4
        ? syncSafe(b, pos)
        : (((b[pos] << 24) |
            (b[pos + 1] << 16) |
            (b[pos + 2] << 8) |
            b[pos + 3]) >>>
            0) +
          4;
    pos += ext;
  }

  const end = Math.min(b.length, 10 + tagSize);
  const idLen = major === 2 ? 3 : 4;
  const hdrLen = major === 2 ? 6 : 10;

  while (pos + hdrLen <= end) {
    let id = "";
    for (let i = 0; i < idLen; i++) id += String.fromCharCode(b[pos + i]);
    if (!/^[A-Z0-9]+$/.test(id)) break;

    let size: number;
    if (major === 2) {
      size = (b[pos + 3] << 16) | (b[pos + 4] << 8) | b[pos + 5];
    } else if (major === 4) {
      size = syncSafe(b, pos + 4);
    } else {
      size =
        ((b[pos + 4] << 24) |
          (b[pos + 5] << 16) |
          (b[pos + 6] << 8) |
          b[pos + 7]) >>>
        0;
    }

    const dataStart = pos + hdrLen;
    if (size <= 0 || dataStart + size > b.length) break;

    if (frameIds.includes(id)) {
      const text = decodeId3Text(
        b.subarray(dataStart + 1, dataStart + size),
        b[dataStart],
      );
      if (text && text.trim()) return text.trim();
    }

    pos = dataStart + size;
  }
  return undefined;
};

const isUnknownArtist = (a?: string | null): boolean => {
  if (!a) return true;
  const t = a.trim();
  if (!t) return true;
  return /^<?\s*unknown(\s+artist)?\s*>?$/i.test(t);
};

const parseId3Artist = (b: Uint8Array): string | undefined => {
  const primary = readId3Frame(b, ["TPE1", "TP1"]);
  if (primary && !isUnknownArtist(primary)) return primary;
  const albumArtist = readId3Frame(b, ["TPE2", "TP2"]);
  return !isUnknownArtist(albumArtist) ? albumArtist : undefined;
};

const parseId3Album = (b: Uint8Array): string | undefined =>
  readId3Frame(b, ["TALB", "TAL"]);

const parseId3Title = (b: Uint8Array): string | undefined =>
  readId3Frame(b, ["TIT2", "TT2"]);

export type SongTags = {
  title?: string;
  artist?: string;
  album?: string;
};

const readTagsFromFile = async (uri: string): Promise<SongTags> => {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 131072,
    });
    const bytes = base64ToBytes(b64);
    const title = parseId3Title(bytes);
    const artist = parseId3Artist(bytes);
    const album = parseId3Album(bytes);
    return {
      title: title && title.trim() ? title.trim() : undefined,
      artist: artist && !isUnknownArtist(artist) ? artist : undefined,
      album: album && album.trim() ? album.trim() : undefined,
    };
  } catch {
    return {};
  }
};

// ── Module-level caches — shared across all hook instances ─────────
const tagCache: Record<string, SongTags> = {};
const inFlight: Record<string, Promise<SongTags>> = {};
const EMPTY_TAGS: SongTags = {};

const STORAGE_KEY = "@id3_tags_v1";
const CONCURRENCY = 6;

let diskLoaded = false;
let diskLoading: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const loadDiskCache = async (): Promise<void> => {
  if (diskLoaded) return;
  if (diskLoading) return diskLoading;
  diskLoading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          Object.assign(tagCache, parsed);
        }
      }
    } catch {}
    diskLoaded = true;
  })();
  return diskLoading;
};

const schedulePersist = () => {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tagCache)).catch(() => {});
  }, 1500);
};

const readWithConcurrency = async (
  items: { id: string; uri: string }[],
  onResult: (id: string, tags: SongTags) => void,
): Promise<void> => {
  if (items.length === 0) return;
  let idx = 0;

  const run = async () => {
    while (idx < items.length) {
      const i = idx++;
      const { id, uri } = items[i];

      let tags: SongTags;
      if (inFlight[id]) {
        tags = await inFlight[id];
      } else {
        const p = readTagsFromFile(uri);
        inFlight[id] = p;
        try {
          tags = await p;
        } finally {
          delete inFlight[id];
        }
      }

      tagCache[id] = tags;
      onResult(id, tags);
    }
  };

  const n = Math.min(CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: n }, run));
  schedulePersist();
};

// ── Public hook ───────────────────────────────────────────────────
export function useId3Tags(songs: any[]) {
  // Seed initial state from the in-memory cache so previously-read songs
  // appear immediately on mount (no blank frame).
  const [tagData, setTagData] = useState<Record<string, SongTags>>(() => ({
    ...tagCache,
  }));
  const [metaReady, setMetaReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (songs.length === 0) {
      setMetaReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      // 1. Hydrate from AsyncStorage (fast — ~10 ms on first launch).
      await loadDiskCache();

      // 2. Push any cached values into state immediately.
      if (!cancelled && mounted.current) {
        setTagData({ ...tagCache });
      }

      // 3. Determine which songs still need reading.
      const missing = songs.filter((s) => {
        if (tagCache[s.id] || inFlight[s.id]) return false;
        const uri = (s as any).uri ?? (s as any).path;
        return !!uri;
      });

      if (missing.length === 0) {
        if (mounted.current && !cancelled) setMetaReady(true);
        return;
      }

      const items = missing.map((s) => ({
        id: s.id,
        uri: (s as any).uri ?? (s as any).path,
      }));

      // 4. Batch state updates every 60 ms so partial results render
      //    continuously instead of waiting for the whole batch to finish.
      let batch: Record<string, SongTags> = {};
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flush = () => {
        flushTimer = null;
        if (Object.keys(batch).length === 0) return;
        const toApply = batch;
        batch = {};
        if (!cancelled && mounted.current) {
          setTagData((prev) => ({ ...prev, ...toApply }));
        }
      };

      await readWithConcurrency(items, (id, tags) => {
        batch[id] = tags;
        if (!flushTimer) flushTimer = setTimeout(flush, 60);
      });

      if (flushTimer) clearTimeout(flushTimer);
      flush();

      if (!cancelled && mounted.current) setMetaReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [songs]);

  return { tagData, metaReady };
}

export { EMPTY_TAGS };