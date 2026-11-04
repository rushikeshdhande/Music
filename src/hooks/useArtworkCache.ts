import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';

// NOTE: `expo-music-info-2` was removed. Internally it imports the old
// "expo-file-system" API, which throws on Expo SDK 54 (that is why every
// song logged "[artwork] extract failed"). Cover art is now read directly
// from the ID3v2 "APIC" frame using the legacy file-system API.

const CACHE_KEY = '@artwork_map_v2'; // bumped: forces a fresh extraction
const ART_DIR = `${FileSystem.documentDirectory}artwork_cache/`;
const MAX_TAG_BYTES = 8 * 1024 * 1024; // never read more than 8 MB of tag

type ArtworkMap = Record<string, string>;

// ---------------------------------------------------------------------------
// base64 helpers
// ---------------------------------------------------------------------------
const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64_CHARS.length; i++) t[B64_CHARS.charCodeAt(i)] = i;
  return t;
})();

const base64ToBytes = (b64: string): Uint8Array => {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const outLen = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)] || 0;
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)] || 0;
    const c = B64_LOOKUP[clean.charCodeAt(i + 2)] || 0;
    const d = B64_LOOKUP[clean.charCodeAt(i + 3)] || 0;
    if (p < outLen) out[p++] = (a << 2) | (b >> 4);
    if (p < outLen) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < outLen) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < len ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < len ? B64_CHARS[b2 & 63] : '=';
  }
  return out;
};

const readBytes = async (
  uri: string,
  position: number,
  length: number
): Promise<Uint8Array> => {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return base64ToBytes(b64);
};

// ---------------------------------------------------------------------------
// ID3v2 cover-art (APIC / PIC) reader
// ---------------------------------------------------------------------------
const syncSafe = (b: Uint8Array, o: number) =>
  ((b[o] & 0x7f) << 21) |
  ((b[o + 1] & 0x7f) << 14) |
  ((b[o + 2] & 0x7f) << 7) |
  (b[o + 3] & 0x7f);

const be32 = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

// Undo "unsynchronisation": 0xFF 0x00 -> 0xFF
const removeUnsync = (b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(b.length);
  let p = 0;
  for (let i = 0; i < b.length; i++) {
    out[p++] = b[i];
    if (b[i] === 0xff && i + 1 < b.length && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, p);
};

const imageExt = (img: Uint8Array, mime: string): string => {
  if (img[0] === 0xff && img[1] === 0xd8) return 'jpg';
  if (img[0] === 0x89 && img[1] === 0x50 && img[2] === 0x4e) return 'png';
  if (img[0] === 0x47 && img[1] === 0x49 && img[2] === 0x46) return 'gif';
  if (img[0] === 0x52 && img[1] === 0x49 && img[2] === 0x46) return 'webp';
  const m = mime.toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('gif')) return 'gif';
  if (m.includes('webp')) return 'webp';
  return 'jpg';
};

type Picture = { bytes: Uint8Array; ext: string };

const parseApic = (
  data: Uint8Array,
  isV22: boolean
): Picture | null => {
  if (data.length < 8) return null;
  const enc = data[0];
  let i = 1;
  let mime = '';

  if (isV22) {
    // 3-char image format, e.g. "JPG" / "PNG"
    mime = String.fromCharCode(data[1], data[2], data[3]);
    i = 4;
  } else {
    while (i < data.length && data[i] !== 0) {
      mime += String.fromCharCode(data[i]);
      i++;
    }
    i++; // null terminator
  }

  i++; // picture type byte

  // description (encoding-dependent terminator)
  if (enc === 1 || enc === 2) {
    while (i + 1 < data.length && !(data[i] === 0 && data[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < data.length && data[i] !== 0) i++;
    i++;
  }

  if (i >= data.length) return null;
  const img = data.subarray(i);
  if (img.length < 32) return null;
  return { bytes: img, ext: imageExt(img, mime) };
};

async function readId3Picture(uri: string): Promise<Picture | null> {
  const header = await readBytes(uri, 0, 10);
  if (
    header.length < 10 ||
    header[0] !== 0x49 || // I
    header[1] !== 0x44 || // D
    header[2] !== 0x33 //    3
  ) {
    return null; // not an ID3v2 file (m4a / flac / etc.)
  }

  const major = header[3];
  const flags = header[5];
  const tagSize = syncSafe(header, 6);
  if (tagSize <= 0) return null;

  let body = await readBytes(uri, 10, Math.min(tagSize, MAX_TAG_BYTES));
  if (flags & 0x80 && major < 4) body = removeUnsync(body);

  let pos = 0;
  if (major >= 3 && flags & 0x40) {
    // extended header
    pos += major === 4 ? syncSafe(body, 0) : be32(body, 0) + 4;
  }

  const isV22 = major === 2;
  const idLen = isV22 ? 3 : 4;
  const hdrLen = isV22 ? 6 : 10;

  while (pos + hdrLen <= body.length) {
    let id = '';
    for (let k = 0; k < idLen; k++) id += String.fromCharCode(body[pos + k]);
    if (!/^[A-Z0-9]+$/.test(id)) break; // padding reached

    let size: number;
    if (isV22) size = (body[pos + 3] << 16) | (body[pos + 4] << 8) | body[pos + 5];
    else if (major === 4) size = syncSafe(body, pos + 4);
    else size = be32(body, pos + 4);

    const start = pos + hdrLen;
    if (size <= 0 || start + size > body.length) break;

    if (id === 'APIC' || id === 'PIC') {
      let data = body.subarray(start, start + size);
      // v2.4 per-frame unsync / data-length-indicator
      if (major === 4) {
        const fFlags = body[pos + 9];
        if (fFlags & 0x01) data = data.subarray(4); // data length indicator
        if (fFlags & 0x02) data = removeUnsync(data);
      }
      const pic = parseApic(data, isV22);
      if (pic) return pic;
    }

    pos = start + size;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------
async function ensureDir() {
  const info = await FileSystem.getInfoAsync(ART_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ART_DIR, { intermediates: true });
  }
}

async function loadPersistedMap(): Promise<ArtworkMap> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ArtworkMap;

    const verified: ArtworkMap = {};
    for (const [id, uri] of Object.entries(parsed)) {
      if (!uri.startsWith('file://')) {
        verified[id] = uri;
        continue;
      }
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) verified[id] = uri;
    }
    return verified;
  } catch {
    return {};
  }
}

function persistMap(map: ArtworkMap) {
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map)).catch(() => {});
}

async function writeArtworkFile(
  songId: string,
  pic: Picture
): Promise<string | null> {
  try {
    const path = `${ART_DIR}${songId}.${pic.ext}`;
    await FileSystem.writeAsStringAsync(path, bytesToBase64(pic.bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  } catch {
    return null;
  }
}

async function extractArtworkForSong(song: any): Promise<string | null> {
  try {
    let fileUri: string | undefined = song.uri;

    if (!fileUri || !fileUri.startsWith('file://')) {
      try {
        const asset: any = await MediaLibrary.getAssetInfoAsync(song.id);
        fileUri = asset?.localUri ?? asset?.uri ?? fileUri;
      } catch {}
    }

    if (!fileUri) return null;

    const pic = await readId3Picture(fileUri);
    if (!pic) return null;

    return await writeArtworkFile(String(song.id), pic);
  } catch (err) {
    console.warn('[artwork] extract failed for', song?.id, err);
    return null;
  }
}

export function useArtworkCache(songs: { id: string }[]) {
  const [map, setMap] = useState<ArtworkMap>({});
  const [ready, setReady] = useState(false);
  const runningRef = useRef(false);
  // songs we already tried (and found no embedded art) - don't retry forever
  const triedRef = useRef<Set<string>>(new Set());

  // 1) Load the persisted map on mount (fast — usually <50ms).
  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureDir();
      const persisted = await loadPersistedMap();
      if (!alive) return;
      setMap(persisted);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) Background extraction in parallel batches.
  useEffect(() => {
    if (!ready || runningRef.current || songs.length === 0) return;

    const missing = songs.filter(
      (s) => !map[s.id] && !triedRef.current.has(String(s.id))
    );
    if (missing.length === 0) return;

    runningRef.current = true;
    let cancelled = false;

    (async () => {
      const BATCH = 4;

      for (let i = 0; i < missing.length; i += BATCH) {
        if (cancelled) break;

        const batch = missing.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map((s) => extractArtworkForSong(s))
        );

        const found: ArtworkMap = {};
        batch.forEach((s, idx) => {
          triedRef.current.add(String(s.id));
          const uri = results[idx];
          if (uri) found[s.id] = uri;
        });

        if (Object.keys(found).length > 0 && !cancelled) {
          setMap((prev) => {
            const next = { ...prev, ...found };
            persistMap(next);
            return next;
          });
        }
      }

      runningRef.current = false;
    })();

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, songs]);

  const remove = useCallback((songId: string) => {
    triedRef.current.delete(String(songId));
    setMap((prev) => {
      const next = { ...prev };
      const uri = next[songId];
      delete next[songId];
      if (uri && uri.startsWith('file://')) {
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
      persistMap(next);
      return next;
    });
  }, []);

  const clear = useCallback(async () => {
    triedRef.current.clear();
    setMap({});
    await AsyncStorage.removeItem(CACHE_KEY);
    try {
      await FileSystem.deleteAsync(ART_DIR, { idempotent: true });
      await ensureDir();
    } catch {}
  }, []);

  return { artworkMap: map, ready, remove, clear };
}