import * as FileSystem from "expo-file-system/legacy";

/**
 * Reads song info (title / artist / album = movie) from the ID3 tag at the
 * start of an MP3 file. Place this file at: src/utils/id3Tags.ts
 */
export type SongTags = {
  title?: string;
  artist?: string;
  album?: string;
};

export const isUnknownArtist = (a?: string | null): boolean => {
  if (!a) return true;
  const t = a.trim();
  if (!t) return true;
  return /^<?\s*unknown(\s+artist)?\s*>?$/i.test(t);
};

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
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) {
    return undefined;
  }
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

export const readId3Tags = async (uri: string): Promise<SongTags> => {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 131072,
    });
    const bytes = base64ToBytes(b64);

    const title = readId3Frame(bytes, ["TIT2", "TT2"]);
    const album = readId3Frame(bytes, ["TALB", "TAL"]);

    let artist = readId3Frame(bytes, ["TPE1", "TP1"]);
    if (!artist || isUnknownArtist(artist)) {
      artist = readId3Frame(bytes, ["TPE2", "TP2"]);
    }

    return {
      title: title && title.trim() ? title.trim() : undefined,
      artist: artist && !isUnknownArtist(artist) ? artist : undefined,
      album: album && album.trim() ? album.trim() : undefined,
    };
  } catch {
    return {};
  }
};