// src/screens/HomeScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Pressable,
  Animated,
  useWindowDimensions,
  AppState,
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import * as FileSystem from "expo-file-system/legacy";
import { getColors } from "react-native-image-colors";
import { useVideoPlayer, VideoView } from "expo-video";

import Header from "../../components/Header";
import { ScreenLoader } from "../../components/Loader"; // ✅ Imported new Loader
// 👇 Import TopStatusGlass
import TopStatusGlass from "../../components/TopStatusGlass";
import { useTheme } from "../../hooks/useTheme";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMediaScanner } from "../../hooks/useMediaScanner";
import { useMediaStore } from "../../store/mediaStore";
import { usePlayHistoryStore } from "../../store/playHistoryStore";
import { useArtworkCache } from "../../hooks/useArtworkCache";
import { useVideoStore } from "../../store/videoStore";
import { useUserStore } from "../../store/userStore";
import { MUSIC_VIDEOS } from "../../data/musicVideos";
import { showToast } from "../../utils/toast";
import {
  cleanSiteName,
  isUnknownArtist,
  UNKNOWN_ARTIST,
} from "../../utils/cleanSiteName";

const VIDEO_BY_ID: Record<string, any> = {};
MUSIC_VIDEOS.forEach((v: any) => {
  VIDEO_BY_ID[v.id] = v;
});

const FONT = "serif";
const SECTION_TITLE_SIZE = 20;
const MUSIC_DEFAULT_PNG = require("../../../assets/images/musicdefault.png");
const GRADIENT_VIDEO = require("../../../assets/images/gradientvd.mp4");
const STATION_PNG = require("../../../assets/images/Station.png");
const FAV_PAGE_PNG = require("../../../assets/images/favouritepageimage.png");
const GET_UP_DESC =
  "Whether it's a weekday morning or Saturday night, get going with this personalised set of upbeat music. Refreshed every Monday.";
const FAV_DESC = "All the songs that made you reach for the star.";
const GETUP_PAD = 14;

const EMPTY_FAV: Record<string, boolean> = {};

const NO_ALBUM_RE =
  /^(<?\s*(unknown(\s+album)?|n\/?a|untitled|various(\s+artists?)?|none|null|no\s+album|-+)\s*>?)$/i;

const NO_ARTIST_RE =
  /^(<?\s*(unknown(\s+artist)?|n\/?a|various(\s+artists?)?|none|null|no\s+artist|-+)\s*>?)$/i;

const NO_TITLE_RE =
  /^(<?\s*(unknown(\s+song)?|n\/?a|untitled|none|null|-+)\s*>?)$/i;

const stripSiteSuffix = (raw: string): string => {
  if (!raw) return "";
  return raw
    .replace(/\s*[\(\[]\s*[^\)\]]*\.[a-z]{2,6}\s*[\)\]]\s*$/gi, "")
    .replace(
      /\s+[a-z0-9\-]+\.(?:com|net|org|in|pm|cc|tv|fm|io|me|co|pk|se|xyz|online|site|app|info|club|live|mobi|ws|us|uk)\s*$/gi,
      "",
    )
    .trim();
};

const parseArtistTitle = (raw: string): { artist: string; title: string } => {
  if (!raw) return { artist: "", title: "" };
  const cleaned = stripSiteSuffix(raw);
  const m = cleaned.match(/^(.{2,100}?)\s+[-–—]\s+(.{1,200})$/);
  if (m) {
    const left = m[1].trim();
    const right = m[2].trim();
    if (
      left.length >= 2 &&
      left.length <= 80 &&
      right.length >= 1 &&
      !/^\d+\s/.test(left)
    ) {
      return { artist: left, title: right };
    }
  }
  return { artist: "", title: cleaned };
};

const MAX_SONGS = 10;
const MAX_RECENT_PLAYED = 10;
const TOP_CARD_W = 220;
const SONG_CARD = 135;
const VIDEO_CARD_W = SONG_CARD;
const CARD_GAP = 12;

const TOP_TOTAL = 10;
const SHUFFLE_EVERY_MS = 45 * 1000;

const TOP_INFO_H = 70;
const TOP_DEEP_FACTOR = 0.6;
const TOP_INFO_BG_ALPHA = 0.9;
const TOP_SHADOW_OPACITY = 0.55;
const TOP_SHADOW_RADIUS = 8;
const TOP_FADE_START = 0.6;

const ART_WAIT_MS = 500;

const EMPTY: any[] = [];

type TagData = { title?: string; artist?: string; album?: string };

const TAG_CACHE: Record<string, TagData> = {};
const REQUESTED_TAG_IDS = new Set<string>();
const ART_KEEP: Record<string, string> = {};
let ALL_TAGS_LOADED = false;
let ALL_ART_SETTLED = false;
let SCAN_STARTED = false;

const DEFAULT_COLORS = {
  background: "#000000",
  surface: "#1c1c1e",
  surfaceLight: "#2c2c2e",
  border: "#3a3a3c",
  text: "#ffffff",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  primary: "#f92c47",
};

type DeckItem =
  | { kind: "getup"; key: string }
  | { kind: "station"; key: string }
  | { kind: "fav"; key: string }
  | { kind: "song"; key: string; song: any };

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const out = arr.slice();
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const ChevronRightIcon = ({
  size = 20,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 5l7 7-7 7"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const getTimestamp = (song: any): number => {
  const candidates = [
    song?.dateAdded,
    song?.createdAt,
    song?.modificationTime,
    song?.creationTime,
    song?.timestamp,
    song?.addedAt,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
    if (typeof c === "string") {
      const t = Date.parse(c);
      if (!isNaN(t)) return t;
    }
  }
  return 0;
};

const TOP_CARD_FALLBACK = "#1c1c1e";

const darkenHexSimple = (hex: string, factor: number): string => {
  let h = (hex || "").trim().replace(/^#/, "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  const d = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n * factor)))
      .toString(16)
      .padStart(2, "0");
  return `#${d(r)}${d(g)}${d(b)}`;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  let h = (hex || "").trim().replace(/^#/, "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
};

const withAlpha = (hex: string, a: number): string => {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : hex;
};

const mixHex = (fg: string, bg: string, a: number): string => {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!f || !b) return fg;
  const m = (i: number) =>
    Math.round(f[i] * a + b[i] * (1 - a))
      .toString(16)
      .padStart(2, "0");
  return `#${m(0)}${m(1)}${m(2)}`;
};

const topCardColorCache = new Map<string, string>();

const useTopCardColor = (uri: string | null): string => {
  const [color, setColor] = useState<string>(() => {
    if (!uri) return TOP_CARD_FALLBACK;
    return topCardColorCache.get(uri) ?? TOP_CARD_FALLBACK;
  });

  useEffect(() => {
    if (!uri) {
      setColor(TOP_CARD_FALLBACK);
      return;
    }
    const cached = topCardColorCache.get(uri);
    if (cached) {
      setColor(cached);
      return;
    }
    let cancelled = false;
    getColors(uri, { fallback: TOP_CARD_FALLBACK, cache: true, key: uri })
      .then((result: any) => {
        let picked = TOP_CARD_FALLBACK;
        if (result?.platform === "ios") {
          picked = result.primary || result.background || TOP_CARD_FALLBACK;
        } else {
          picked =
            result?.dominant ||
            result?.average ||
            result?.darkVibrant ||
            TOP_CARD_FALLBACK;
        }
        topCardColorCache.set(uri, picked);
        if (topCardColorCache.size > 100) {
          topCardColorCache.delete(
            topCardColorCache.keys().next().value as string,
          );
        }
        if (!cancelled) setColor(picked);
      })
      .catch(() => {
        if (!cancelled) setColor(TOP_CARD_FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return color;
};

// ── ID3v2 parsing ──────────────────────────────────────────────────────────
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
    if (size <= 0) break;
    if (dataStart + size > b.length) {
      pos = dataStart + size;
      continue;
    }

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

const parseId3Title = (b: Uint8Array): string | undefined =>
  readId3Frame(b, ["TIT2", "TT2"]);

const parseId3Artist = (b: Uint8Array): string | undefined => {
  const primary = readId3Frame(b, ["TPE1", "TP1"]);
  if (primary && !isUnknownArtist(primary)) return primary;
  const albumArtist = readId3Frame(b, ["TPE2", "TP2"]);
  return !isUnknownArtist(albumArtist) ? albumArtist : undefined;
};

const parseId3Album = (b: Uint8Array): string | undefined =>
  readId3Frame(b, ["TALB", "TAL"]);

const readTagsFromFile = async (
  uri: string,
): Promise<{ title?: string; artist?: string; album?: string }> => {
  try {
    const headerB64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 10,
    });
    const headerBytes = base64ToBytes(headerB64);

    let readLen = 1024 * 1024;
    if (
      headerBytes.length >= 10 &&
      headerBytes[0] === 0x49 &&
      headerBytes[1] === 0x44 &&
      headerBytes[2] === 0x33
    ) {
      const tagSize = syncSafe(headerBytes, 6);
      readLen = Math.min(10 + tagSize + 32, 8 * 1024 * 1024);
    }

    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: readLen,
    });
    const bytes = base64ToBytes(b64);
    return {
      title: parseId3Title(bytes),
      artist: parseId3Artist(bytes),
      album: parseId3Album(bytes),
    };
  } catch {
    return {};
  }
};

const GetUpVideoCard = React.memo(function GetUpVideoCard({
  width,
  height,
  styles,
  onPress,
}: {
  width: number;
  height: number;
  styles: any;
  onPress: () => void;
}) {
  const isFocused = useIsFocused();

  const player = useVideoPlayer(GRADIENT_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!player) return;
    try {
      if (isFocused) player.play();
      else player.pause();
    } catch {}
  }, [player, isFocused]);

  useEffect(() => {
    if (!player) return;
    const sub = AppState.addEventListener("change", (state) => {
      try {
        if (state === "active" && isFocused) player.play();
        else player.pause();
      } catch {}
    });
    return () => sub.remove();
  }, [player, isFocused]);

  useEffect(() => {
    return () => {
      try {
        player?.pause();
      } catch {}
    };
  }, [player]);

  const [expanded, setExpanded] = useState(false);
  const [desc, setDesc] = useState<{ text: string; more: boolean } | null>(
    null,
  );

  const onMeasure = useCallback((e: any) => {
    const lines: { text: string }[] = e?.nativeEvent?.lines ?? [];
    let next: { text: string; more: boolean };
    if (lines.length <= 2) {
      next = { text: GET_UP_DESC, more: false };
    } else {
      const first = lines[0].text ?? "";
      let second = (lines[1].text ?? "").replace(/\s+$/, "");
      second = second
        .slice(0, Math.max(0, second.length - 6))
        .replace(/[\s,.;:!\-–—]+$/, "");
      next = { text: first + second + "…", more: true };
    }
    setDesc((prev) =>
      prev && prev.text === next.text && prev.more === next.more ? prev : next,
    );
  }, []);

  return (
    <View style={{ width, marginRight: CARD_GAP }}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: "transparent" }}
        style={[styles.topCard, { width, height, backgroundColor: "#000" }]}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />

        <View style={styles.getUpCenter} pointerEvents="none">
          <Text style={styles.getUpText}>Get Up!</Text>
        </View>

        <View style={styles.getUpDescWrap}>
          <Text
            style={[styles.getUpDesc, styles.getUpMeasure]}
            onTextLayout={onMeasure}
            pointerEvents="none"
          >
            {GET_UP_DESC}
          </Text>

          <View style={styles.getUpDescInner}>
            {!desc ? (
              <Text style={styles.getUpDesc} numberOfLines={2}>
                {GET_UP_DESC}
              </Text>
            ) : desc.more && !expanded ? (
              <Text style={styles.getUpDesc}>
                {desc.text}
                <Text
                  style={styles.getUpMore}
                  onPress={() => setExpanded(true)}
                >
                  {""}
                </Text>
              </Text>
            ) : (
              <Text style={styles.getUpDesc}>
                {GET_UP_DESC}
                {desc.more ? (
                  <Text
                    style={styles.getUpMore}
                    onPress={() => setExpanded(false)}
                  >
                    {""}
                  </Text>
                ) : null}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
});

const StationCard = React.memo(function StationCard({
  userName,
  width,
  height,
  styles,
  onPress,
}: {
  userName: string;
  width: number;
  height: number;
  styles: any;
  onPress: () => void;
}) {
  return (
    <View style={{ width, marginRight: CARD_GAP }}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: "transparent" }}
        style={[styles.topCard, { width, height, backgroundColor: "#000" }]}
      >
        {({ pressed }) => (
          <>
            <View style={styles.stationImgWrap} pointerEvents="none">
              <Image
                source={STATION_PNG}
                style={styles.stationImg}
                resizeMode="contain"
                fadeDuration={0}
              />
            </View>

            <Svg
              width={width}
              height={height}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Defs>
                <SvgLinearGradient id="stationBtm" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
                  <Stop offset="1" stopColor="#000" stopOpacity={0.75} />
                </SvgLinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="url(#stationBtm)"
              />
            </Svg>

            <View style={styles.cardBottomText} pointerEvents="none">
              <Text style={styles.topLabel}>Made for you</Text>
              <Text numberOfLines={1} style={styles.topName}>
                {userName ? `${userName}'s Station` : "Station"}
              </Text>
            </View>

            {pressed && (
              <View style={styles.pressOverlay} pointerEvents="none" />
            )}
          </>
        )}
      </Pressable>
    </View>
  );
});

const FavouriteCard = React.memo(function FavouriteCard({
  width,
  height,
  styles,
  onPress,
}: {
  width: number;
  height: number;
  styles: any;
  onPress: () => void;
}) {
  const iconSize = Math.round(width * 0.82);

  return (
    <View style={{ width, marginRight: CARD_GAP }}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: "transparent" }}
        style={[styles.topCard, { width, height, backgroundColor: "#9e9e9e" }]}
      >
        {({ pressed }) => (
          <>
            <View style={styles.favIconWrap} pointerEvents="none">
              <Image
                source={FAV_PAGE_PNG}
                style={{
                  width: iconSize,
                  height: iconSize,
                  borderRadius: 10,
                }}
                resizeMode="contain"
                fadeDuration={0}
              />
            </View>

            <View style={styles.cardBottomText} pointerEvents="none">
              <Text style={styles.topLabel}>Made by you</Text>
              <Text numberOfLines={1} style={styles.topName}>
                Favourite Songs
              </Text>
              <Text numberOfLines={2} style={styles.favDesc}>
                {FAV_DESC}
              </Text>
            </View>

            {pressed && (
              <View style={styles.pressOverlay} pointerEvents="none" />
            )}
          </>
        )}
      </Pressable>
    </View>
  );
});

const TopPickCard = React.memo(function TopPickCard({
  pick,
  index,
  width,
  height,
  imgH,
  styles,
  onPress,
}: {
  pick: any;
  index: number;
  width: number;
  height: number;
  imgH: number;
  styles: any;
  onPress: () => void;
}) {
  const uri = (pick.artwork as string | undefined) || null;
  const color = useTopCardColor(uri);

  const [artFailed, setArtFailed] = useState(false);
  useEffect(() => {
    setArtFailed(false);
  }, [uri]);

  const darkerColor = useMemo(() => darkenHexSimple(color, 0.55), [color]);
  const deepColor = useMemo(
    () => darkenHexSimple(color, TOP_DEEP_FACTOR),
    [color],
  );
  const infoBlend = useMemo(
    () => mixHex(deepColor, TOP_CARD_FALLBACK, TOP_INFO_BG_ALPHA),
    [deepColor],
  );

  const safeId =
    `${index}_` + String(pick.id ?? "").replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = `tpcBg${safeId}`;
  const bottomFadeId = `tpcBtm${safeId}`;
  const topShadeId = `tpcTop${safeId}`;

  const rawAlbum = String(pick.album ?? "").trim();
  const rawTitle = String(pick.title ?? "").trim();
  const rawArtist = String(pick.artist ?? "").trim();
  const rawFilename = (pick as any).filename
    ? String((pick as any).filename)
        .replace(/\.[^/.]+$/, "")
        .trim()
    : "";

  const movieName = rawAlbum && !NO_ALBUM_RE.test(rawAlbum) ? rawAlbum : "";
  const songTitle = rawTitle && !NO_TITLE_RE.test(rawTitle) ? rawTitle : "";
  const artistName =
    rawArtist && !NO_ARTIST_RE.test(rawArtist) ? rawArtist : "";

  const primaryName = movieName || songTitle || rawFilename || "";

  const hasArt = !!uri && !artFailed;
  const defaultArtSize = Math.round(width * 0.82);

  return (
    <Pressable
      onPress={onPress}
      style={{ width, marginRight: CARD_GAP }}
      android_ripple={{ color: "transparent" }}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.topCardShadow,
            {
              shadowColor: deepColor,
              backgroundColor: TOP_CARD_FALLBACK,
            },
            !hasArt && { shadowOpacity: 0, elevation: 0 },
          ]}
        >
          <View
            style={[styles.topCard, { backgroundColor: TOP_CARD_FALLBACK }]}
          >
            <View style={{ width, height: imgH }}>
              <Svg width={width} height={imgH} style={StyleSheet.absoluteFill}>
                <Defs>
                  <SvgLinearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <Stop offset="0" stopColor={color} stopOpacity={1} />
                    <Stop offset="1" stopColor={darkerColor} stopOpacity={1} />
                  </SvgLinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill={`url(#${gradientId})`}
                />
              </Svg>

              {uri && !artFailed ? (
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  fadeDuration={0}
                  onError={() => setArtFailed(true)}
                />
              ) : (
                <View style={styles.noArtWrap} pointerEvents="none">
                  <Image
                    source={MUSIC_DEFAULT_PNG}
                    style={{
                      width: defaultArtSize,
                      height: defaultArtSize,
                      borderRadius: 10,
                      backgroundColor: "#1c1c1e",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.3)",
                    }}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                </View>
              )}

              <Svg
                width={width}
                height={imgH}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                <Defs>
                  <SvgLinearGradient
                    id={topShadeId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <Stop offset="0" stopColor="#000" stopOpacity={0.22} />
                    <Stop offset="0.28" stopColor="#000" stopOpacity={0} />
                  </SvgLinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill={`url(#${topShadeId})`}
                />
              </Svg>

              <Svg
                width={width}
                height={imgH}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                <Defs>
                  <SvgLinearGradient
                    id={bottomFadeId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <Stop
                      offset={TOP_FADE_START}
                      stopColor={infoBlend}
                      stopOpacity={0}
                    />
                    <Stop
                      offset={TOP_FADE_START + (1 - TOP_FADE_START) * 0.4}
                      stopColor={infoBlend}
                      stopOpacity={0.38}
                    />
                    <Stop
                      offset={TOP_FADE_START + (1 - TOP_FADE_START) * 0.75}
                      stopColor={infoBlend}
                      stopOpacity={0.82}
                    />
                    <Stop offset="1" stopColor={infoBlend} stopOpacity={1} />
                  </SvgLinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill={`url(#${bottomFadeId})`}
                />
              </Svg>
            </View>

            <View
              style={[
                styles.topInfo,
                { backgroundColor: withAlpha(deepColor, TOP_INFO_BG_ALPHA) },
              ]}
            >
              <Text style={styles.topLabel}>Made for you</Text>

              {primaryName ? (
                <Text numberOfLines={1} style={styles.topName}>
                  {primaryName}
                </Text>
              ) : null}

              {artistName ? (
                <Text numberOfLines={1} style={styles.topMovieName}>
                  {artistName}
                </Text>
              ) : null}
            </View>

            {pressed && (
              <View style={styles.pressOverlay} pointerEvents="none" />
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
});

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const themeRaw = useTheme() as any;
  const base =
    themeRaw && typeof themeRaw === "object" && themeRaw.background
      ? themeRaw
      : themeRaw?.colors && typeof themeRaw.colors === "object"
        ? themeRaw.colors
        : themeRaw?.theme && typeof themeRaw.theme === "object"
          ? themeRaw.theme
          : {};
  const COLORS = { ...DEFAULT_COLORS, ...base };
  const styles = useMemo(() => createStyles(COLORS), [themeRaw]); // eslint-disable-line

  const storedName = useUserStore((s: any) => s.name);
  const userLoaded = useUserStore((s: any) => s.loaded);
  const loadUser = useUserStore((s: any) => s.load);
  const userName: string = String(storedName ?? "").trim();

  useEffect(() => {
    if (userLoaded) return;
    Promise.resolve(loadUser?.()).catch(() => {});
  }, [userLoaded, loadUser]);

  const audio = useAudioPlayer() as any;
  const { loadAndPlay } = audio;

  const { scanAll } = useMediaScanner() as any;

  const songs: any[] = useMediaStore((s: any) => s.songs ?? EMPTY);
  const { artworkMap } = useArtworkCache(songs);

  const playQueue = useVideoStore((s: any) => s.playQueue);

  const recentItems = usePlayHistoryStore((s) => s.recentItems);
  const playCounts = usePlayHistoryStore((s) => s.counts);
  const recordVideoPlay = usePlayHistoryStore((s) => s.recordVideoPlay);

  const favorites: Record<string, boolean> = useMediaStore(
    (s: any) => s.favoritesSong ?? EMPTY_FAV,
  );
  const favCount = useMemo(
    () => songs.filter((s: any) => !!favorites[s.id || s._id]).length,
    [songs, favorites],
  );

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [scanning, setScanning] = useState(songs.length === 0 && !SCAN_STARTED);
  const scanStarted = useRef(SCAN_STARTED);

  const [metaReady, setMetaReady] = useState(ALL_TAGS_LOADED);
  const [artSettled, setArtSettled] = useState(ALL_ART_SETTLED);

  useEffect(() => {
    if (metaReady) ALL_TAGS_LOADED = true;
  }, [metaReady]);

  useEffect(() => {
    if (artSettled) ALL_ART_SETTLED = true;
  }, [artSettled]);

  useEffect(() => {
    if (songs.length > 0) {
      setScanning(false);
      return;
    }
    if (SCAN_STARTED) {
      setScanning(false);
      return;
    }
    SCAN_STARTED = true;
    scanStarted.current = true;
    setScanning(true);
    Promise.resolve(scanAll?.())
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setScanning(false);
      });
  }, [songs.length]); // eslint-disable-line

  useEffect(() => {
    Object.keys(artworkMap).forEach((id) => {
      const uri = artworkMap[id];
      if (uri) ART_KEEP[id] = uri;
    });
  }, [artworkMap]);

  useEffect(() => {
    if (ALL_ART_SETTLED) {
      if (!artSettled) setArtSettled(true);
      return;
    }
    if (songs.length === 0 || artSettled) return;

    const allHaveArt = songs.every(
      (s: any) => s.artwork || artworkMap[s.id] || ART_KEEP[s.id],
    );
    if (allHaveArt) {
      setArtSettled(true);
      return;
    }

    const t = setTimeout(() => {
      if (mounted.current) setArtSettled(true);
    }, ART_WAIT_MS);
    return () => clearTimeout(t);
  }, [songs, artworkMap, artSettled]);

  const [tagCache, setTagCache] = useState<Record<string, TagData>>(() => ({
    ...TAG_CACHE,
  }));
  const requestedTagIds = useRef(REQUESTED_TAG_IDS);

  useEffect(() => {
    if (songs.length === 0) return;

    if (ALL_TAGS_LOADED) {
      if (!metaReady) setMetaReady(true);
      return;
    }

    const toRead = songs.filter((s: any) => {
      const id = s.id || s._id;
      return (
        id &&
        !requestedTagIds.current.has(id) &&
        ((s as any).uri || (s as any).path)
      );
    });

    if (toRead.length === 0) {
      setMetaReady(true);
      return;
    }

    toRead.forEach((s: any) => requestedTagIds.current.add(s.id || s._id));

    (async () => {
      let batch: Record<string, TagData> = {};
      let count = 0;

      const flush = () => {
        if (Object.keys(batch).length > 0 && mounted.current) {
          const toSave = batch;
          setTagCache((prev) => ({ ...prev, ...toSave }));
          Object.assign(TAG_CACHE, toSave);
        }
        batch = {};
      };

      for (const s of toRead) {
        if (!mounted.current) return;

        const uri = (s as any).uri ?? (s as any).path;
        const id = s.id || s._id;
        if (!uri || !id) continue;

        const { title, artist, album } = await readTagsFromFile(uri);
        const cleanTitle = cleanSiteName(title);
        const cleanArtist = cleanSiteName(artist, false);
        const cleanAlbum = cleanSiteName(album, false);

        if (cleanTitle || !isUnknownArtist(cleanArtist) || cleanAlbum) {
          batch[id] = {
            title: cleanTitle || undefined,
            artist: !isUnknownArtist(cleanArtist) ? cleanArtist : undefined,
            album: cleanAlbum || undefined,
          };
        }

        count++;
        if (count % 10 === 0) flush();
      }

      flush();
      if (mounted.current) setMetaReady(true);
    })();
  }, [songs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Instant stop + store cleanup when a song disappears ──────────────
  const prevSongIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set<string>();
    for (const s of songs) {
      const id = s.id || s._id;
      if (id) currentIds.add(id);
    }

    if (prevSongIds.current.size > 0 && currentIds.size > 0) {
      const deleted: string[] = [];
      prevSongIds.current.forEach((id) => {
        if (!currentIds.has(id)) deleted.push(id);
      });

      if (deleted.length > 0) {
        const deletedSet = new Set(deleted);

        const currentId =
          audio.currentId ??
          audio.currentSongId ??
          audio.current?.id ??
          audio.playingId;

        if (currentId && deletedSet.has(currentId)) {
          try {
            audio.stop?.();
            audio.pause?.();
            audio.stopAll?.();
          } catch {}
        }

        try {
          audio.removeFromQueue?.(deleted);
          audio.removeSongs?.(deleted);
          audio.filterQueue?.((x: any) => !deletedSet.has(x.id));
        } catch {}

        try {
          const queue: any[] =
            (useVideoStore as any).getState().playQueue ?? [];
          const filtered = queue.filter((v: any) => !deletedSet.has(v.id));
          if (filtered.length !== queue.length) {
            (useVideoStore as any).getState().setPlayQueue?.(filtered);
            (useVideoStore as any).setState?.({ playQueue: filtered });
          }
        } catch {}

        try {
          const hist = (usePlayHistoryStore as any).getState();
          hist.removeItems?.(deleted);
          hist.pruneIds?.(deleted);
          hist.removeFromRecent?.(deleted);
        } catch {}

        try {
          (useMediaStore as any).getState().removeFavourites?.(deleted);
          (useMediaStore as any).getState().pruneFavourites?.(deleted);
        } catch {}

        showToast(
          deleted.length === 1
            ? "Song deleted"
            : `${deleted.length} songs deleted`,
        );
      }
    }

    if (currentIds.size > 0) {
      prevSongIds.current = currentIds;
    }
  }, [songs, audio]);

  // ── Safety net: file deleted externally → stop on foreground ─────────
  useEffect(() => {
    if (!isFocused) return;

    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;

      const currentUri =
        audio.currentUri ??
        audio.current?.uri ??
        audio.currentSong?.uri ??
        audio.current?.path;

      if (!currentUri) return;

      try {
        const info = await FileSystem.getInfoAsync(currentUri);
        if (!info.exists) {
          try {
            audio.stop?.();
            audio.pause?.();
          } catch {}
          showToast("Song file removed — playback stopped");
        }
      } catch {}
    });

    return () => sub.remove();
  }, [isFocused, audio]);

  const libSongs = useMemo(
    () =>
      songs.map((s: any) => {
        const id = s.id || s._id;
        const tag = tagCache[id] || {};

        const rawTitle = String(
          (tag.title && tag.title.trim()) ||
            (s.title && String(s.title).trim()) ||
            (s.filename
              ? String(s.filename)
                  .replace(/\.[^/.]+$/, "")
                  .trim()
              : "") ||
            "",
        );

        const parsed = parseArtistTitle(rawTitle);

        const cleanArtist = cleanSiteName(s.artist, false);
        const taggedArtist = cleanSiteName(tag.artist, false);
        const artist = !isUnknownArtist(taggedArtist)
          ? taggedArtist
          : !isUnknownArtist(cleanArtist)
            ? cleanArtist
            : parsed.artist || UNKNOWN_ARTIST;

        const title =
          cleanSiteName(tag.title) ||
          parsed.title ||
          cleanSiteName(s.title) ||
          "Unknown song";

        const album =
          cleanSiteName(tag.album, false) ||
          cleanSiteName(s.album, false) ||
          "";

        return {
          ...s,
          id,
          title,
          artist,
          album,
          artwork: s.artwork ?? s.artworkUri ?? artworkMap[id] ?? ART_KEEP[id],
        };
      }),
    [songs, artworkMap, tagCache],
  );

  const songById = useMemo(() => {
    const m: Record<string, any> = {};
    libSongs.forEach((s: any) => {
      m[s.id] = s;
    });
    return m;
  }, [libSongs]);

  const recentSongs = useMemo(() => {
    const indexed = libSongs.map((s: any, i: number) => ({
      song: s,
      ts: getTimestamp(s),
      i,
    }));

    indexed.sort((a, b) => {
      const aArt = a.song.artwork ? 1 : 0;
      const bArt = b.song.artwork ? 1 : 0;
      if (aArt !== bArt) return bArt - aArt;

      const aHas = a.ts > 0;
      const bHas = b.ts > 0;

      if (aHas && bHas && a.ts !== b.ts) return b.ts - a.ts;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;

      const at = (a.song.title || "").toLowerCase();
      const bt = (b.song.title || "").toLowerCase();
      if (at !== bt) return at < bt ? -1 : 1;

      const ai = String(a.song.id ?? "");
      const bi = String(b.song.id ?? "");
      if (ai !== bi) return ai < bi ? -1 : 1;

      return a.i - b.i;
    });

    return indexed.map((x: any) => x.song).slice(0, MAX_SONGS);
  }, [libSongs]);

  const topPicks = useMemo(() => {
    type Ranked = { song: any; count: number; recency: number };
    const ranked: Ranked[] = [];
    for (const s of libSongs) {
      const count = playCounts[s.id] ?? 0;
      if (count <= 0) continue;
      if (!s.artwork) continue;

      const rIdx = recentItems.findIndex((x) => x.k === "s" && x.id === s.id);
      ranked.push({
        song: s,
        count,
        recency: rIdx === -1 ? Infinity : rIdx,
      });
    }
    ranked.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.recency - b.recency;
    });
    return ranked.slice(0, TOP_TOTAL).map((x) => x.song);
  }, [libSongs, playCounts, recentItems]);

  const recentlyPlayed = useMemo(() => {
    const out: any[] = [];
    for (const it of recentItems) {
      if (it.k === "s") {
        const song = songById[it.id];
        if (song) out.push({ kind: "song", key: "s-" + it.id, data: song });
      } else {
        const video = VIDEO_BY_ID[it.id];
        if (video) out.push({ kind: "video", key: "v-" + it.id, data: video });
      }
      if (out.length >= MAX_RECENT_PLAYED) break;
    }
    return out;
  }, [recentItems, songById]);

  const playFrom = async (list: any[], song: any) => {
    const index = list.findIndex((s: any) => s.id === song.id);
    if (index < 0) {
      showToast("Song unavailable — scan again");
      return;
    }
    const playable = list.map((s: any) => ({
      ...s,
      artworkUri: s.artwork,
      cover: s.artwork,
    }));
    try {
      await loadAndPlay(playable, index);
    } catch {
      showToast("Playback failed");
    }
  };

  const playRandom = useCallback(async () => {
    if (libSongs.length === 0) {
      showToast("No songs found — scan again");
      return;
    }
    const shuffled = libSongs.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const playable = shuffled.map((s: any) => ({
      ...s,
      artworkUri: s.artwork,
      cover: s.artwork,
    }));
    try {
      await loadAndPlay(playable, 0);
    } catch {
      showToast("Playback failed");
    }
  }, [libSongs, loadAndPlay]);

  const playStation = useCallback(async () => {
    if (libSongs.length === 0) {
      showToast("No songs found — scan again");
      return;
    }
    const played = libSongs.filter((s: any) => (playCounts[s.id] ?? 0) > 0);
    const pool = (played.length > 0 ? played : libSongs).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const playable = pool.map((s: any) => ({
      ...s,
      artworkUri: s.artwork,
      cover: s.artwork,
    }));
    try {
      await loadAndPlay(playable, 0);
    } catch {
      showToast("Playback failed");
    }
  }, [libSongs, playCounts, loadAndPlay]);

  const openFavourites = useCallback(() => {
    nav.navigate("FavouriteSongs");
  }, [nav]);

  const openAlbum = useCallback(
    (pick: any) => {
      const albumName = String(pick.album || "").trim();
      if (!albumName) {
        showToast("Album info unavailable");
        return;
      }

      const sameAlbum = libSongs.filter(
        (s: any) =>
          String(s.album || "")
            .trim()
            .toLowerCase() === albumName.toLowerCase(),
      );
      const songIds = sameAlbum.map((s: any) => s.id).filter(Boolean);

      nav.navigate("AlbumDetails", {
        albumName,
        songIds,
        artwork: pick.artwork ?? undefined,
      });
    },
    [libSongs, nav],
  );

  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  const videoH = SONG_CARD;

  const { width: winW } = useWindowDimensions();
  const topCardW = Math.min(TOP_CARD_W, winW - 40);
  const topCardImgH = topCardW;
  const topCardH = topCardImgH + TOP_INFO_H;

  const showLoading =
    scanning || (songs.length > 0 && !ALL_TAGS_LOADED && !ALL_ART_SETTLED);

  const showRecent = !showLoading && recentlyPlayed.length > 0;
  const showSongsSection = !showLoading && songs.length > 0;

  const topScrollRef = useRef<ScrollView>(null);
  const topDragging = useRef(false);
  const [shuffleSeed, setShuffleSeed] = useState<number>(() =>
    Math.floor(Math.random() * 1e9),
  );

  useEffect(() => {
    if (!isFocused) return;
    const t = setInterval(() => {
      if (topDragging.current) return;
      setShuffleSeed(Math.floor(Math.random() * 1e9));
      topScrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    }, SHUFFLE_EVERY_MS);
    return () => clearInterval(t);
  }, [isFocused]);

  const deck = useMemo<DeckItem[]>(() => {
    const fixed: DeckItem[] = [
      { kind: "getup", key: "getup" },
      { kind: "station", key: "station" },
    ];
    if (favCount > 0) fixed.push({ kind: "fav", key: "fav" });

    if (showLoading) return fixed;

    const used = new Set<string>();
    const topTier: DeckItem[] = [];
    const fillTier: DeckItem[] = [];

    const push = (arr: DeckItem[], s: any, requireArt: boolean) => {
      if (!s) return;
      const id = s.id || s._id;
      if (!id || used.has(id)) return;
      if (requireArt && !s.artwork) return;
      used.add(id);
      arr.push({ kind: "song", key: "p-" + id, song: s });
    };

    topPicks.forEach((s) => push(topTier, s, true));
    recentSongs.forEach((s) => push(fillTier, s, true));
    libSongs.forEach((s: any) => push(fillTier, s, true));
    libSongs.forEach((s: any) => push(fillTier, s, false));

    const slotsLeft = Math.max(0, TOP_TOTAL - fixed.length - topTier.length);
    const shuffledFill = seededShuffle(fillTier, shuffleSeed);

    return [...fixed, ...topTier, ...shuffledFill.slice(0, slotsLeft)];
  }, [favCount, showLoading, topPicks, recentSongs, libSongs, shuffleSeed]);

  const renderSongRow = (list: any[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.hList}
    >
      {list.map((song: any) => (
        <TouchableOpacity
          key={song.id}
          activeOpacity={0.8}
          style={{ width: SONG_CARD, marginRight: CARD_GAP }}
          onPress={() => playFrom(list, song)}
        >
          <Image
            source={song.artwork ? { uri: song.artwork } : MUSIC_DEFAULT_PNG}
            style={styles.songArt}
            resizeMode="cover"
            fadeDuration={0}
          />
          <Text numberOfLines={1} style={styles.cardTitle}>
            {song.title}
          </Text>
          <Text numberOfLines={1} style={styles.cardSub}>
            {song.artist}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderRecentRow = (items: any[]) => {
    const songList = items.filter((x) => x.kind === "song").map((x) => x.data);
    const videoList = items
      .filter((x) => x.kind === "video")
      .map((x) => x.data);

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hList}
      >
        {items.map((item: any) => {
          if (item.kind === "song") {
            const song = item.data;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.8}
                style={{ width: SONG_CARD, marginRight: CARD_GAP }}
                onPress={() => playFrom(songList, song)}
              >
                <Image
                  source={
                    song.artwork ? { uri: song.artwork } : MUSIC_DEFAULT_PNG
                  }
                  style={styles.songArt}
                  resizeMode="cover"
                  fadeDuration={0}
                />
                <Text numberOfLines={1} style={styles.cardTitle}>
                  {song.title}
                </Text>
                <Text numberOfLines={1} style={styles.cardSub}>
                  {song.artist}
                </Text>
              </TouchableOpacity>
            );
          }

          const v = item.data;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.8}
              style={{ width: VIDEO_CARD_W, marginRight: CARD_GAP }}
              onPress={() => {
                playQueue(
                  videoList,
                  videoList.findIndex((x: any) => x.id === v.id),
                );
                setTimeout(() => recordVideoPlay(v.id), 0);
              }}
            >
              <View
                style={[
                  styles.videoThumbWrap,
                  { width: VIDEO_CARD_W, height: videoH },
                ]}
              >
                <Image
                  source={{ uri: v.thumbnail }}
                  style={styles.thumb}
                  resizeMode="stretch"
                  fadeDuration={0}
                />
                <View style={styles.videoBadge}>
                  <Text style={styles.videoBadgeText}>▶ Video</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.cardTitle}>
                {v.title}
              </Text>
              <Text numberOfLines={1} style={styles.cardSub}>
                {v.artist}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderDeckItem = (item: DeckItem, idx: number) => {
    switch (item.kind) {
      case "getup":
        return (
          <GetUpVideoCard
            key={item.key}
            width={topCardW}
            height={topCardH}
            styles={styles}
            onPress={playRandom}
          />
        );
      case "station":
        return (
          <StationCard
            key={item.key}
            userName={userName}
            width={topCardW}
            height={topCardH}
            styles={styles}
            onPress={playStation}
          />
        );
      case "fav":
        return (
          <FavouriteCard
            key={item.key}
            width={topCardW}
            height={topCardH}
            styles={styles}
            onPress={openFavourites}
          />
        );
      default:
        return (
          <TopPickCard
            key={item.key}
            pick={item.song}
            index={idx}
            width={topCardW}
            height={topCardH}
            imgH={topCardImgH}
            styles={styles}
            onPress={() => openAlbum(item.song)}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <Header scrollY={scrollY} />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 75 + insets.top },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ opacity: showLoading ? 0 : 1 }}
        pointerEvents={showLoading ? "none" : "auto"}
      >
        <View style={styles.topPickSection}>
          <View style={styles.topPickHeader}>
            <Text style={styles.sectionTitle}>Top Picks for You</Text>
          </View>

          <ScrollView
            ref={topScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topPicksScroll}
            onScrollBeginDrag={() => {
              topDragging.current = true;
            }}
            onScrollEndDrag={() => {
              setTimeout(() => {
                topDragging.current = false;
              }, 4000);
            }}
          >
            {deck.map((item, idx) => renderDeckItem(item, idx))}
          </ScrollView>
        </View>

        <View style={styles.body}>
          {showRecent && (
            <>
              <TouchableOpacity
                style={[styles.sectionHeader, { marginTop: 20 }]}
                onPress={() => nav.navigate("Queue")}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.sectionTitle}>Recently Played</Text>
                <View style={styles.chevron}>
                  <ChevronRightIcon size={20} color={COLORS.textSecondary} />
                </View>
              </TouchableOpacity>

              {renderRecentRow(recentlyPlayed)}
            </>
          )}

          {showSongsSection && (
            <>
              <TouchableOpacity
                style={[styles.sectionHeader, { marginTop: 28 }]}
                onPress={() => nav.navigate("Songs")}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.sectionTitle}>Songs</Text>
                <View style={styles.chevron}>
                  <ChevronRightIcon size={20} color={COLORS.textSecondary} />
                </View>
              </TouchableOpacity>

              {renderSongRow(recentSongs)}
            </>
          )}

          <View style={{ height: 180 }} />
        </View>
      </Animated.ScrollView>

      {/* ✅ New ScreenLoader used here (no bg, no border) */}
      <ScreenLoader visible={showLoading} />

      {/* 👇 Added TopStatusGlass overlay for the edge-to-edge fade */}
      <TopStatusGlass />
    </View>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    content: { paddingTop: 105 },
    body: { paddingTop: 0 },

    topPickSection: { marginTop: 8 },
    topPickHeader: { paddingHorizontal: 20, marginBottom: 12 },
    topPicksScroll: {
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 2,
      paddingBottom: 18,
    },
    stationImgWrap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 72,
      alignItems: "center",
      justifyContent: "center",
    },
    stationImg: {
      marginTop: 73,
      width: 230,
      height: 290,
    },
    sectionHeader: {
      flexDirection: "row",
      alignSelf: "flex-start",
      alignItems: "center",
      minHeight: 26,
      marginBottom: 12,
      paddingHorizontal: 20,
    },
    chevron: { marginLeft: 4, marginTop: 2 },
    sectionTitle: {
      color: COLORS.text,
      fontSize: SECTION_TITLE_SIZE,
      lineHeight: 26,
      fontWeight: "700",
      letterSpacing: -0.3,
      fontFamily: FONT,
    },
    hList: { paddingLeft: 20, paddingRight: 20 },

    topCardShadow: {
      borderRadius: 18,
      backgroundColor: COLORS.surface,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: TOP_SHADOW_OPACITY,
      shadowRadius: TOP_SHADOW_RADIUS,
      elevation: 12,
    },
    topCard: {
      borderRadius: 15,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: "rgba(255,255,255,0.18)",
    },
    topLabel: {
      color: "rgba(255,255,255,0.72)",
      marginBottom: 2,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.4,
      fontFamily: FONT,
    },
    topInfo: {
      minHeight: TOP_INFO_H,
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 10,
    },
    topName: {
      color: "#ffffff",
      fontSize: 14,
      lineHeight: 17,
      fontWeight: "800",
      fontFamily: FONT,
      marginTop: 2,
      textShadowColor: "rgba(0,0,0,0.35)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    topMovieName: {
      color: "rgba(255,255,255,0.75)",
      fontSize: 14,
      lineHeight: 17,
      fontWeight: "400",
      fontFamily: FONT,
      marginTop: 2,
    },

    cardBottomText: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 14,
      alignItems: "flex-start",
    },
    favDesc: {
      color: "rgba(255,255,255,0.85)",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500",
      fontFamily: FONT,
      marginTop: 4,
    },
    favIconWrap: {
      position: "absolute",
      top: 16,
      left: 0,
      right: 0,
      alignItems: "center",
    },

    noArtWrap: {
      position: "absolute",
      top: 16,
      left: 0,
      right: 0,
      alignItems: "center",
    },

    getUpCenter: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
    },
    getUpText: {
      color: "#ffffff",
      fontSize: 40,
      fontWeight: "800",
      fontFamily: FONT,
      letterSpacing: -0.3,
    },
    getUpDescWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
    },
    getUpDescInner: {
      paddingHorizontal: GETUP_PAD,
      paddingTop: 8,
      paddingBottom: 12,
    },
    getUpMeasure: {
      position: "absolute",
      left: GETUP_PAD,
      right: GETUP_PAD,
      top: 0,
      opacity: 0,
    },
    getUpDesc: {
      color: "rgb(255, 255, 255)",
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "500",
      fontFamily: FONT,
    },
    getUpMore: {
      color: "#ffffff",
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "500",
      fontFamily: FONT,
    },
    pressOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "hsla(0, 0%, 0%, 0.23)",
      borderRadius: 15,
    },

    songArt: {
      width: SONG_CARD,
      height: SONG_CARD,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      borderWidth: 0.5,
      borderColor: COLORS.border,
    },
    videoThumbWrap: {
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: COLORS.surface,
      borderWidth: 0.5,
      borderColor: COLORS.border,
    },
    thumb: { width: "100%", height: "100%" },
    videoBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    videoBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
      fontFamily: FONT,
    },

    cardTitle: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: "700",
      marginTop: 8,
      fontFamily: FONT,
    },
    cardSub: {
      color: COLORS.textSecondary,
      fontSize: 12,
      marginTop: 2,
      fontFamily: FONT,
    },

    empty: {
      color: COLORS.textSecondary,
      fontSize: 15,
      paddingVertical: 24,
      paddingHorizontal: 20,
      fontFamily: FONT,
    },
  });