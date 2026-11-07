// ============================================================
//  src/screens/FavouriteSongsScreen.tsx
// ============================================================
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
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  Easing,
  Modal,
  ScrollView,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItemInfo,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import Svg, { Path } from "react-native-svg";

import { useUserName } from "../hooks/useUserName";
import { useTheme } from "../hooks/useTheme";
import { useMediaStore } from "../store/mediaStore";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useArtworkCache } from "../hooks/useArtworkCache";
import { showToast } from "../utils/toast";
import { Song } from "../types";
import { ShuffleIcon, PlayIcon } from "../icons/Icons";
import { getCachedTags } from "../services/audioTags/tagService";


const FONT = "sans-serif";
const STORAGE_PLAYLISTS = "@library_playlists";

// ✅ Title appears once the hero image has fully scrolled under the header
//    (search bar ~64 + hero 220 + margin 18 ≈ 302 → show a bit before that)
// ✅ Hero image geometry (used to know when it has scrolled under the header)
const HERO_SIZE = 220;
const HERO_TOP_GAP = 8;
const SEARCH_BLOCK = 64; // search bar height + its margins

const AnimatedFlatList: any = Animated.FlatList;
const HEADER_HEIGHT = 52;


const DIVIDER_LEFT = 84;
const DIVIDER_RIGHT = 16;

const POPUP_BG = "#1c1c1e";
const TAG_CONCURRENCY = 8;

// ── assets ──────────────────────────────────────────────────
const FAVOURITE_HERO = require("../../assets/images/favouritepageimage.png");
const SEARCH_ICON = require("../../assets/images/search.png");
const MORE_PNG = require("../../assets/apple/moreicon.png");
const PLAY_PNG = require("../../assets/apple/playicon.png");
const MUSIC_DEFAULT_PNG = require("../../assets/images/musicdefault.png");

// ===========================================================================
// Back arrow SVG
// ===========================================================================
const BackArrowSvg = ({
  size = 24,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42a.996.996 0 0 0-1.41 0l-6.59 6.59a.996.996 0 0 0 0 1.41l6.59 6.59a.996.996 0 1 0 1.41-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1"
      fill={color}
    />
  </Svg>
);

// ===========================================================================
// Pin Playlist icon
// ===========================================================================
const PinPlaylistIcon = ({
  size = 24,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="-0.4 -0.8 68.4 68.4">
    <Path
      fill={color}
      d="M32.2 62c.6 0 2.3-3.3 2.3-7.3v-14h-4.6v14c0 4 1.7 7.3 2.3 7.3M16 42.8h32.4c2.3 0 3.8-1.5 3.8-3.7 0-7.5-8.5-15.1-20-15.1s-20 7.6-20 15.1c0 2.2 1.5 3.7 3.8 3.7m1-4c-.5 0-.8-.2-.7-1 .5-4.6 6.5-10 15.9-10s15.3 5.4 15.9 10c0 .8-.2 1-.8 1zm-1.5-34a4 4 0 0 0 1 2.5c1.3 1.7 4.4 4.1 7.6 6.3l-1 13.5h4.2l1-15.4c0-.4 0-.5-.3-.7-4-2-7-4.3-7-4.8-.3-.3 0-.5.2-.5h22c.2 0 .5.2.3.5a25 25 0 0 1-7.1 4.8c-.2.2-.3.3-.2.7L37 27h4l-.9-13.5a37 37 0 0 0 7.7-6.3 4 4 0 0 0 1-2.5c0-1.6-1.2-2.7-3-2.7H18.5c-1.8 0-3 1.1-3 2.7Z"
    />
  </Svg>
);

// ===========================================================================
// Popup row icons
// ===========================================================================
const SortIcon = ({ size = 24, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      fill={color}
      d="M7 5C7.55228 5 8 5.44772 8 6V15.5858L10.2929 13.2929C10.6834 12.9024 11.3166 12.9024 11.7071 13.2929C12.0976 13.6834 12.0976 14.3166 11.7071 14.7071L7.70711 18.7071C7.31658 19.0976 6.68342 19.0976 6.29289 18.7071L2.29289 14.7071C1.90237 14.3166 1.90237 13.6834 2.29289 13.2929C2.68342 12.9024 3.31658 12.9024 3.70711 13.2929L6 15.5858V6C6 5.44772 6.44772 5 7 5ZM16.2929 5.29289C16.6834 4.90237 17.3166 4.90237 17.7071 5.29289L21.7071 9.29289C22.0976 9.68342 22.0976 10.3166 21.7071 10.7071C21.3166 11.0976 20.6834 11.0976 20.2929 10.7071L18 8.41421V18C18 18.5523 17.5523 19 17 19C16.4477 19 16 18.5523 16 18V8.41421L13.7071 10.7071C13.3166 11.0976 12.6834 11.0976 12.2929 10.7071C11.9024 10.3166 11.9024 9.68342 12.2929 9.29289L16.2929 5.29289Z"
    />
  </Svg>
);

const SearchSongIcon = ({ size = 24, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const AddPlaylistIcon = ({ size = 24, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="3.6 3.6 16.8 16.8">
    <Path
      fill={color}
      fillOpacity={0.95}
      d="M9.92 11.354c.966 0 1.453-.487 1.453-1.49v-3.4c0-1.004-.487-1.483-1.453-1.483H6.452C5.487 4.981 5 5.46 5 6.464v3.4c0 1.003.487 1.49 1.452 1.49zm7.628 0c.965 0 1.452-.487 1.452-1.49v-3.4c0-1.004-.487-1.483-1.452-1.483h-3.46c-.974 0-1.46.479-1.46 1.483v3.4c0 1.003.486 1.49 1.46 1.49zm-7.65-1.073h-3.43q-.397.002-.396-.418v-3.4q-.002-.41.396-.41h3.43c.265 0 .402.137.402.41v3.4c0 .281-.137.418-.403.418m7.634 0h-3.43c-.273 0-.402-.137-.402-.418v-3.4c0-.273.129-.41.403-.41h3.43q.396 0 .395.41v3.4q.002.42-.396.418m-7.612 8.7c.966 0 1.453-.48 1.453-1.483v-3.407c0-.996-.487-1.483-1.453-1.483H6.452c-.965 0-1.452.487-1.452 1.483v3.407c0 1.004.487 1.483 1.452 1.483zm7.628 0c.965 0 1.452-.48 1.452-1.483v-3.407c0-.996-.487-1.483-1.452-1.483h-3.46c-.974 0-1.46.487-1.46 1.483v3.407c0 1.004.486 1.483 1.46 1.483zm-7.65-1.072h-3.43q-.397 0-.396-.41v-3.4c0-.282.13-.418.396-.418h3.43c.265 0 .402.136.402.418v3.4c0 .273-.137.41-.403.41m7.634 0h-3.43c-.273 0-.402-.137-.402-.41v-3.4c0-.282.129-.418.403-.418h3.43c.265 0 .395.136.395.418v3.4q.002.41-.396.41"
    />
  </Svg>
);

const FavStarIcon = ({ size = 24, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill={color}
      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
    />
  </Svg>
);

// ===========================================================================
// Theme tokens
// ===========================================================================
const SCREEN_BG_DARK = "#2d2e30";
const SCREEN_BG_LIGHT = "#ffffff";
const FIELD_BG_DARK = "#3d3e40";
const FIELD_BG_LIGHT = "#f2f2f4";

const LIGHT_THEME = {
  mode: "light" as const,
  background: SCREEN_BG_LIGHT,
  field: FIELD_BG_LIGHT,
  surface: "#f2f2f4",
  surfaceLight: "#e2e3e5",
  border: "#c8c9cc",
  divider: "#b8b9bc",
  rowDivider: "#d1d2d4",
  text: "#000000",
  textSecondary: "#3c3c43",
  textMuted: "#8e8e93",
  primary: "#f92c47",
};

const DARK_THEME = {
  mode: "dark" as const,
  background: SCREEN_BG_DARK,
  field: FIELD_BG_DARK,
  surface: "#3a3b3d",
  surfaceLight: "#45464a",
  border: "#525356",
  divider: "#5a5b5e",
  rowDivider: "#46474a",
  text: "#ffffff",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  primary: "#f92c47",
};

type Playlist = {
  id: string;
  name: string;
  artwork?: string | null;
  songs?: any[];
  createdAt?: number;
  updatedAt?: number;
};

const UNKNOWN_ARTIST = "Unknown artist";

const shuffleArr = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getArtwork = (s: any): string | undefined =>
  s?.artwork ?? s?.artworkUri ?? s?.cover ?? undefined;

const DefaultSongArt = React.memo(function DefaultSongArt({
  style,
}: {
  style?: any;
}) {
  return (
    <Image
      source={MUSIC_DEFAULT_PNG}
      style={style}
      resizeMode="cover"
      fadeDuration={0}
    />
  );
});

const SafeImage = React.memo(function SafeImage({
  uri,
  style,
  reloadKey = 0,
  resizeMode = "cover",
}: {
  uri?: string | null;
  style: any;
  reloadKey?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri, reloadKey]);

  let safeUri = uri;
  if (
    safeUri &&
    !safeUri.startsWith("http") &&
    !safeUri.startsWith("file://") &&
    !safeUri.startsWith("content://") &&
    !safeUri.startsWith("ph://") &&
    !safeUri.startsWith("data:")
  ) {
    safeUri = `file://${safeUri}`;
  }

  if (!safeUri || failed) {
    return <DefaultSongArt style={style} />;
  }

  return (
    <Image
      source={{ uri: safeUri }}
      style={style}
      resizeMode={resizeMode}
      fadeDuration={0}
      onError={() => setFailed(true)}
    />
  );
});

// ===========================================================================
// ARTIST helpers
// ===========================================================================
const isUnknownArtist = (a?: string | null): boolean => {
  if (!a) return true;
  const t = a.trim();
  if (!t) return true;
  return /^<?\s*unknown(\s+artist)?\s*>?$/i.test(t);
};

const getStoreArtist = (s: any): string => {
  const candidates = [
    s?.artist,
    s?.artists,
    s?.albumArtist,
    s?.album_artist,
    s?.author,
    s?.composer,
    s?.contributingArtist,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && !isUnknownArtist(c)) return c.trim();
    if (Array.isArray(c) && c.length > 0) {
      const joined = c.filter(Boolean).join(", ");
      if (joined && !isUnknownArtist(joined)) return joined;
    }
  }
  return "";
};

// ── ID3 tag reader (fallback for uncached songs) ────────────
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

const parseId3Artist = (b: Uint8Array): string | undefined => {
  const primary = readId3Frame(b, ["TPE1", "TP1"]);
  if (primary && !isUnknownArtist(primary)) return primary;
  const albumArtist = readId3Frame(b, ["TPE2", "TP2"]);
  return !isUnknownArtist(albumArtist) ? albumArtist : undefined;
};

const readArtistFromFile = async (uri: string): Promise<string | undefined> => {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 131072,
    });
    const artist = parseId3Artist(base64ToBytes(b64));
    return artist && !isUnknownArtist(artist) ? artist : undefined;
  } catch {
    return undefined;
  }
};

// ===========================================================================
const getDurationSec = (s: any): number => {
  const d =
    s?.duration ?? s?.durationSec ?? s?.durationSeconds ?? s?.length ?? 0;
  const num = typeof d === "number" ? d : parseFloat(d);
  if (!isFinite(num) || num <= 0) return 0;
  return num > 10000 ? num / 1000 : num;
};

const formatTotalDuration = (totalSec: number): string => {
  if (!totalSec || totalSec < 1) return "0 minutes";
  const totalMin = Math.round(totalSec / 60);
  if (totalMin < 1) {
    return `${Math.round(totalSec)} second${Math.round(totalSec) === 1 ? "" : "s"}`;
  }
  if (totalMin < 60) {
    return `${totalMin} minute${totalMin === 1 ? "" : "s"}`;
  }
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (mins === 0) return `${hrs} hr${hrs === 1 ? "" : "s"}`;
  return `${hrs} hr ${mins} min`;
};

// ===========================================================================
const POPUP_ART_SIZE = 72;

function PopupArtwork({ uri, bg }: { uri?: string; bg: string }) {
  return (
    <SafeImage
      uri={uri}
      style={{
        width: POPUP_ART_SIZE,
        height: POPUP_ART_SIZE,
        borderRadius: 10,
        backgroundColor: bg,
      }}
    />
  );
}

// ===========================================================================
// ✅ SongRow — memoized
// ===========================================================================
type SongRowProps = {
  item: Song & { artist?: string; artwork?: string };
  isPinned: boolean;
  colors: any;
  styles: any;
  onPress: (song: Song) => void;
  onTogglePin: (song: Song) => void;
  onMore: (song: Song) => void;
};

const SongRow = React.memo(function SongRow({
  item,
  isPinned,
  colors,
  styles,
  onPress,
  onTogglePin,
  onMore,
}: SongRowProps) {
  const artwork = getArtwork(item) ?? (item as any).artwork;
  const artist = (item as any).artist || UNKNOWN_ARTIST;

  return (
    <View style={styles.songRow}>
      <TouchableOpacity
        onPress={() => onTogglePin(item as any)}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        style={styles.starHit}
      >
        <Text style={[styles.star, isPinned && styles.starActive]}>★</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress(item as any)}
        style={styles.artWrap}
      >
        <SafeImage uri={artwork} style={styles.art} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.songInfo}
        activeOpacity={0.7}
        onPress={() => onPress(item as any)}
      >
        <Text style={styles.songTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {artist}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onMore(item as any)}
        hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
        style={styles.dotsHit}
      >
        <Image
          source={MORE_PNG}
          style={[styles.moreIcon, { tintColor: colors.textSecondary }]}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
});

// ===========================================================================
export default function FavouriteSongsScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const themeRaw = useTheme() as any;
  const base =
    themeRaw && typeof themeRaw === "object" && themeRaw.background
      ? themeRaw
      : themeRaw?.colors && typeof themeRaw.colors === "object"
        ? themeRaw.colors
        : LIGHT_THEME;

  const COLORS = useMemo(() => {
    const isDark = (base.mode ?? "dark") === "dark";
    const fallback = isDark ? DARK_THEME : LIGHT_THEME;
    return {
      ...fallback,
      ...base,
      background: isDark ? SCREEN_BG_DARK : SCREEN_BG_LIGHT,
      field: isDark ? FIELD_BG_DARK : FIELD_BG_LIGHT,
    };
  }, [base]);

  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const userName = useUserName();

  const songs = useMediaStore((s) => s.songs);
  const favorites = useMediaStore((s) => s.favoritesSong);
  const toggleFavorite = useMediaStore((s) => s.toggleSongFavorite);

  const { loadAndPlay } = useAudioPlayer();
  const { artworkMap } = useArtworkCache(songs);

  const [pinned, setPinned] = useState<Record<string, boolean>>({});
  const [actionSong, setActionSong] = useState<Song | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [addToOpen, setAddToOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [addSongsOpen, setAddSongsOpen] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<
    Record<string, boolean>
  >({});

  // ✅ Header title: slides up from the header bottom to the centre (smooth),
  //    and is removed instantly when you scroll back up.
  const titleAnim = useRef(new Animated.Value(0)).current;
  const titleShown = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchRef = useRef<TextInput>(null);
  const listRef = useRef<any>(null);

  // hero bottom edge (scroll offset at which it has fully passed the header)
  const heroEnd = HERO_TOP_GAP + HERO_SIZE + (searchVisible ? SEARCH_BLOCK : 0);
  const titleThreshold = useRef(heroEnd + 4);
  titleThreshold.current = heroEnd + 4;

  // ✅ Seed artists synchronously from disk cache
  const [tagArtists, setTagArtists] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    songs.forEach((s) => {
      try {
        const cached = getCachedTags(s.id);
        if (cached?.artist && !isUnknownArtist(cached.artist)) {
          init[s.id] = cached.artist;
        }
      } catch {
        /* cache miss is fine */
      }
    });
    return init;
  });

  const requestedTagIds = useRef<Set<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (songs.length === 0) return;

    const missing = songs.filter(
      (s) =>
        !!favorites[s.id] &&
        !requestedTagIds.current.has(s.id) &&
        !tagArtists[s.id] &&
        !getStoreArtist(s),
    );
    if (missing.length === 0) return;

    missing.forEach((s) => requestedTagIds.current.add(s.id));

    (async () => {
      const results: Record<string, string> = {};
      let cursor = 0;

      const worker = async () => {
        while (cursor < missing.length && mounted.current) {
          const idx = cursor++;
          const s = missing[idx];
          const uri = (s as any).uri ?? (s as any).path;
          if (!uri) continue;
          const artist = await readArtistFromFile(uri);
          if (artist) results[s.id] = artist;
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(TAG_CONCURRENCY, missing.length) },
          () => worker(),
        ),
      );

      if (mounted.current && Object.keys(results).length > 0) {
        setTagArtists((prev) => ({ ...prev, ...results }));
      }
    })();
  }, [songs, favorites]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const next = y > titleThreshold.current;
      if (next === titleShown.current) return;
      titleShown.current = next;

      if (next) {
        // smooth: bottom of header -> centre
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else {
        // instant remove
        titleAnim.stopAnimation();
        titleAnim.setValue(0);
      }
    },
    [titleAnim],
  );

  // ── data ──────────────────────────────────────────────────
  const data = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = songs
      .filter((s) => !!favorites[s.id])
      .map((s) => {
        let artist = getStoreArtist(s) || tagArtists[s.id];
        if (!artist) {
          try {
            const cached = getCachedTags(s.id);
            if (cached?.artist && !isUnknownArtist(cached.artist)) {
              artist = cached.artist;
            }
          } catch {
            /* ignore */
          }
        }
        return {
          ...s,
          artist: artist || UNKNOWN_ARTIST,
          artwork: getArtwork(s) ?? artworkMap[s.id],
        };
      })
      .filter((s) => {
        if (!q) return true;
        const title = (s.title ?? "").toLowerCase();
        const artist = (s.artist ?? "").toLowerCase();
        return title.includes(q) || artist.includes(q);
      });

    return [...list].sort((a, b) => {
      const pa = pinned[a.id] ? 1 : 0;
      const pb = pinned[b.id] ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return (a.title ?? "").localeCompare(b.title ?? "", undefined, {
        sensitivity: "base",
      });
    });
  }, [songs, favorites, artworkMap, pinned, query, tagArtists]);

  const indexMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < data.length; i++) map[data[i].id] = i;
    return map;
  }, [data]);

  const nonFavouriteSongs = useMemo(() => {
    return songs
      .filter((s) => !favorites[s.id])
      .map((s) => ({
        ...s,
        artist: getStoreArtist(s) || tagArtists[s.id] || UNKNOWN_ARTIST,
        artwork: getArtwork(s) ?? artworkMap[s.id],
      }))
      .sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", undefined, {
          sensitivity: "base",
        }),
      );
  }, [songs, favorites, artworkMap, tagArtists]);

  const totalSeconds = useMemo(
    () => data.reduce((sum, s) => sum + getDurationSec(s), 0),
    [data],
  );

  const loadPlaylists = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      setPlaylists(raw ? JSON.parse(raw) : []);
    } catch {
      setPlaylists([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlaylists();
    }, [loadPlaylists]),
  );

  // ── actions ───────────────────────────────────────────────
  const playSong = useCallback(
    (song: Song) => {
      const index = indexMap[song.id];
      if (index === undefined) return;
      try {
        const p = loadAndPlay(data as any, index);
        if (p && typeof (p as any).catch === "function") {
          (p as Promise<any>).catch((e) => {
            console.error("[FavouriteSongs] play error:", e);
            Alert.alert("Playback failed", "Could not play this song.");
          });
        }
      } catch (e) {
        console.error("[FavouriteSongs] play error:", e);
        Alert.alert("Playback failed", "Could not play this song.");
      }
    },
    [data, indexMap, loadAndPlay],
  );

  const playAll = useCallback(
    (shuffled = false) => {
      if (!data.length) return;
      const list = shuffled ? shuffleArr(data) : data;
      try {
        const p = loadAndPlay(list as any, 0);
        if (p && typeof (p as any).catch === "function") {
          (p as Promise<any>).catch((e) =>
            console.error("[FavouriteSongs] playAll error:", e),
          );
        }
      } catch (e) {
        console.error("[FavouriteSongs] playAll error:", e);
      }
    },
    [data, loadAndPlay],
  );

  const togglePin = useCallback((song: Song) => {
    setPinned((prev) => {
      const next = !prev[song.id];
      showToast(next ? "Pinned to top" : "Unpinned");
      return { ...prev, [song.id]: next };
    });
  }, []);

  const removeFavourite = useCallback(
    (song: Song) => {
      toggleFavorite(song.id);
      showToast("Removed from Favourites");
    },
    [toggleFavorite],
  );

  const openMore = useCallback((song: Song) => {
    setActionSong(song);
  }, []);

  const addToPlaylist = async (pl: Playlist, song: Song) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const all: Playlist[] = raw ? JSON.parse(raw) : [];
      const next = all.map((p) =>
        p.id === pl.id
          ? {
              ...p,
              songs: [...(p.songs ?? []), song],
              updatedAt: Date.now(),
              artwork: p.artwork ?? getArtwork(song) ?? null,
            }
          : p,
      );
      await AsyncStorage.setItem(STORAGE_PLAYLISTS, JSON.stringify(next));
      setPlaylists(next);
      setAddToOpen(false);
      showToast(`Added to "${pl.name}"`);
    } catch {
      showToast("Could not add to playlist");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedSongIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleAddSelected = () => {
    const idsToAdd = Object.keys(selectedSongIds).filter(
      (id) => selectedSongIds[id],
    );
    if (idsToAdd.length === 0) {
      showToast("Select at least one song");
      return;
    }
    idsToAdd.forEach((id) => toggleFavorite(id));
    setAddSongsOpen(false);
    showToast(
      `Added ${idsToAdd.length} song${idsToAdd.length === 1 ? "" : "s"} to Favourites`,
    );
  };

  const selectAll = () => {
    const allSelected = nonFavouriteSongs.every((s) => selectedSongIds[s.id]);
    const newSelection: Record<string, boolean> = {};
    if (!allSelected) {
      nonFavouriteSongs.forEach((s) => {
        newSelection[s.id] = true;
      });
    }
    setSelectedSongIds(newSelection);
  };

  const playNext = (song: Song) => {
    showToast(`"${song.title}" will play next`);
  };

  const popupTarget: any = data.length > 0 ? data[0] : null;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<any>) => (
      <SongRow
        item={item}
        isPinned={!!pinned[item.id]}
        colors={COLORS}
        styles={styles}
        onPress={playSong}
        onTogglePin={togglePin}
        onMore={openMore}
      />
    ),
    [pinned, COLORS, styles, playSong, togglePin, openMore],
  );

  const actionArtwork = actionSong
    ? getArtwork(actionSong) ?? (actionSong as any).artwork
    : undefined;
  const actionArtist = actionSong
    ? (actionSong as any).artist || UNKNOWN_ARTIST
    : UNKNOWN_ARTIST;
  const isActionPinned = actionSong ? !!pinned[actionSong.id] : false;

  const topBarHeight = insets.top + HEADER_HEIGHT;
  // ✅ Header colour = screen background colour
  const headerBg = COLORS.background;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [heroEnd - 30, heroEnd + 4],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: onScroll,
      }),
    [scrollY, onScroll],
  );

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* ---------------- LIST ---------------- */}
      <AnimatedFlatList
        ref={listRef}
        style={styles.list}
        data={data}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight,
          paddingBottom: 160,
        }}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ItemSeparatorComponent={() => <View style={styles.songSep} />}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        ListFooterComponent={
          data.length > 0 ? (
            <View>
              <View style={styles.songBottomDivider} />
              <View style={styles.footerInfoRow}>
                <Text style={styles.footerInfoText}>
                  {data.length} {data.length === 1 ? "song" : "songs"},{" "}
                  {formatTotalDuration(totalSeconds)}
                </Text>
              </View>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View>
            {searchVisible && (
              <View style={styles.searchWrap}>
                <Image
                  source={SEARCH_ICON}
                  style={[
                    styles.searchIcon,
                    { tintColor: COLORS.textSecondary },
                  ]}
                />
                <TextInput
                  ref={searchRef}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => {
                    setQuery("");
                    setSearchVisible(false);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.heroWrap}>
              <Image source={FAVOURITE_HERO} style={styles.hero} />
            </View>

            <View style={styles.titleBlock}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Favourite Songs</Text>
                <Text style={styles.titleStar}> ★</Text>
              </View>
              {userName ? (
                <Text style={styles.ownerName}>{userName}</Text>
              ) : null}
            </View>

            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() => playAll(true)}
                activeOpacity={0.8}
              >
                <ShuffleIcon size={18} color={COLORS.text} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playBtn, { backgroundColor: COLORS.text }]}
                onPress={() => playAll(false)}
                activeOpacity={0.85}
              >
                <PlayIcon size={18} color={COLORS.background} />
                <Text style={[styles.playText, { color: COLORS.background }]}>
                  Play
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.circleBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedSongIds({});
                  setAddSongsOpen(true);
                }}
              >
                <Text style={styles.plusText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {data.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  {query ? "No matching songs" : "No favourite song"}
                </Text>
              </View>
            )}
          </View>
        }
      />

      {/* ---------------- TOP BAR — transparent, turns solid after the hero is hidden ---------------- */}
      <View
        pointerEvents="box-none"
        style={[
          styles.topBarWrap,
          { height: topBarHeight, paddingTop: insets.top },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: headerBg, opacity: headerBgOpacity },
          ]}
        />

        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => nav.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackArrowSvg size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.headerCenter,
              {
                opacity: titleAnim,
                transform: [
                  {
                    translateY: titleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [HEADER_HEIGHT / 2, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.headerCenterTitle} numberOfLines={1}>
              Favourite Songs
            </Text>
          </Animated.View>

          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Image
              source={MORE_PNG}
              style={{ width: 16, height: 16, tintColor: COLORS.text }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

 

      {/* ---------------- 3-DOT BOTTOM-SHEET POPUP ---------------- */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
          />
          <View style={styles.popupSheet}>
            <View style={styles.popupHeader}>
              <View style={styles.popupArtWrap}>
                <Image
                  source={FAVOURITE_HERO}
                  style={styles.popupArt}
                  resizeMode="cover"
                />
                {/* play icon in the middle on a transparent white circle */}
                <View style={styles.popupPlayCircle} pointerEvents="none">
                  <Image
                    source={PLAY_PNG}
                    style={styles.popupPlayIcon}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <View style={styles.popupHeaderText}>
                <Text style={styles.popupTitle} numberOfLines={1}>
                  Favourite Song
                </Text>
                {userName ? (
                  <Text style={styles.popupUsername} numberOfLines={1}>
                    {userName}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.popupDivider} />

            <TouchableOpacity
              style={[styles.popupRow, styles.popupRowWithIcon]}
              onPress={() => {
                setMenuOpen(false);
                setSearchVisible(true);
                listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
                setTimeout(() => searchRef.current?.focus(), 350);
              }}
            >
              <SearchSongIcon size={24} color={COLORS.primary} />
              <Text style={[styles.popupRowText, styles.popupRowTextIcon]}>
                Search Song
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.popupRow, styles.popupRowWithIcon]}
              onPress={() => {
                setMenuOpen(false);
                showToast("Sort options coming soon");
              }}
            >
              <SortIcon size={24} color={COLORS.primary} />
              <Text style={[styles.popupRowText, styles.popupRowTextIcon]}>
                Sort By
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.popupRow, styles.popupRowWithIcon]}
              onPress={() => {
                setMenuOpen(false);
                if (popupTarget) togglePin(popupTarget);
              }}
            >
              <PinPlaylistIcon size={24} color={COLORS.primary} />
              <Text style={[styles.popupRowText, styles.popupRowTextIcon]}>
                Pin Playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.popupRow, styles.popupRowWithIcon]}
              onPress={() => {
                setMenuOpen(false);
                if (popupTarget) removeFavourite(popupTarget);
              }}
            >
              <FavStarIcon size={24} color={COLORS.primary} />
              <Text style={[styles.popupRowText, styles.popupRowTextIcon]}>
                Favourite
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.popupRow, styles.popupRowWithIcon]}
              onPress={() => {
                setMenuOpen(false);
                if (popupTarget) {
                  setActionSong(popupTarget);
                  setTimeout(() => setAddToOpen(true), 100);
                }
              }}
            >
              <AddPlaylistIcon size={24} color={COLORS.primary} />
              <Text style={[styles.popupRowText, styles.popupRowTextIcon]}>
                Add to Playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.popupRow, styles.popupRowNoIcon]}
              onPress={() => {
                setMenuOpen(false);
                if (popupTarget) playNext(popupTarget);
              }}
            >
              <Text style={styles.popupRowText}>Play next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------------- SONG ⋮ POPUP — bottom sheet ---------------- */}
      <Modal
        visible={!!actionSong && !addToOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setActionSong(null)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setActionSong(null)}
          />
          <View style={styles.popupSheet}>
            <View style={styles.popupHeader}>
              <SafeImage uri={actionArtwork} style={styles.popupArt} />
              <View style={styles.popupHeaderText}>
                <Text style={styles.popupTitle} numberOfLines={1}>
                  {actionSong?.title ?? "Song options"}
                </Text>
                <Text style={styles.popupUsername} numberOfLines={1}>
                  {actionArtist}
                </Text>
                <Text style={styles.popupUsername} numberOfLines={1}>
                  {isActionPinned ? "Pinned to top" : "In favourites"}
                </Text>
              </View>
            </View>

            <View style={styles.popupDivider} />

            <TouchableOpacity
              style={styles.popupRow}
              onPress={() => {
                const sg = actionSong;
                setActionSong(null);
                if (sg) playSong(sg);
              }}
            >
              <Text style={styles.popupRowText}>Play</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.popupRow}
              onPress={() => {
                if (actionSong) togglePin(actionSong);
                setActionSong(null);
              }}
            >
              <Text style={styles.popupRowText}>
                {isActionPinned ? "Unpin song" : "Pin song on this list"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.popupRow}
              onPress={() => setAddToOpen(true)}
            >
              <Text style={styles.popupRowText}>Add to playlist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.popupRow}
              onPress={() => {
                if (actionSong) playNext(actionSong);
                setActionSong(null);
              }}
            >
              <Text style={styles.popupRowText}>Play next</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.popupRow}
              onPress={() => {
                if (actionSong) removeFavourite(actionSong);
                setActionSong(null);
              }}
            >
              <Text style={[styles.popupRowText, { color: "#E53935" }]}>
                Remove from Favourites
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------------- ADD ONE SONG TO PLAYLIST ---------------- */}
      <Modal
        visible={addToOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddToOpen(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setAddToOpen(false)}
          />
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Add to playlist</Text>

            {playlists.length === 0 ? (
              <Text style={styles.noPlaylists}>
                You don't have any playlists yet.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {playlists.map((pl) => (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.playlistPick}
                    onPress={() => {
                      const s = actionSong;
                      setActionSong(null);
                      if (s) addToPlaylist(pl, s);
                      else setAddToOpen(false);
                    }}
                  >
                    <View style={styles.plIcon}>
                      <Text style={styles.plIconText}>♪</Text>
                    </View>
                    <Text style={styles.optionText} numberOfLines={1}>
                      {pl.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setAddToOpen(false);
                setActionSong(null);
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------------- MULTI-SELECT ADD SONGS MODAL ---------------- */}
      <Modal
        visible={addSongsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddSongsOpen(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setAddSongsOpen(false)}
          />
          <View style={[styles.bottomSheet, { height: "75%" }]}>
            <View style={styles.multiSelectHeader}>
              <Text style={styles.sheetTitle}>Add to Favourites</Text>
              <TouchableOpacity onPress={selectAll} style={{ padding: 4 }}>
                <Text
                  style={{
                    color: COLORS.primary,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  Select All
                </Text>
              </TouchableOpacity>
            </View>

            {nonFavouriteSongs.length === 0 ? (
              <Text style={styles.noPlaylists}>
                You have favourited all your songs!
              </Text>
            ) : (
              <FlatList
                data={nonFavouriteSongs}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={7}
                renderItem={({ item }) => {
                  const isSelected = !!selectedSongIds[item.id];
                  const artwork = getArtwork(item) ?? (item as any).artwork;

                  return (
                    <TouchableOpacity
                      style={styles.selectRow}
                      onPress={() => toggleSelection(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.checkCircle}>
                        {isSelected && (
                          <View style={styles.checkCircleInner}>
                            <Text style={styles.checkText}>✓</Text>
                          </View>
                        )}
                      </View>

                      <SafeImage uri={artwork} style={styles.selectArt} />

                      <View style={styles.selectInfo}>
                        <Text style={styles.selectTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.selectArtist} numberOfLines={1}>
                          {item.artist}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <View style={styles.multiSelectFooter}>
              <TouchableOpacity
                style={styles.cancelMultiBtn}
                onPress={() => setAddSongsOpen(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addSelectedBtn,
                  {
                    opacity: Object.values(selectedSongIds).some(Boolean)
                      ? 1
                      : 0.5,
                  },
                ]}
                onPress={handleAddSelected}
                disabled={!Object.values(selectedSongIds).some(Boolean)}
              >
                <Text style={styles.addSelectedText}>
                  Add Selected (
                  {Object.values(selectedSongIds).filter(Boolean).length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
const createStyles = (C: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    // ✅ list clips its own content so nothing can draw over the header
    list: { flex: 1, backgroundColor: C.background },
    topBarWrap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      elevation: 10,
    },
    listWrap: { flex: 1, overflow: "hidden" },

    topBar: {
      height: HEADER_HEIGHT,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
    },
    headerCenter: {
      position: "absolute",
      left: 56,
      right: 56,
      top: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenterTitle: {
      color: C.text,
      fontSize: 17,
      fontWeight: "600",
      fontFamily: FONT,
      textAlign: "center",
    },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 16,
      backgroundColor: C.field,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 44,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    searchIcon: {
      width: 18,
      height: 18,
      marginRight: 10,
      resizeMode: "contain",
    },
    searchInput: {
      flex: 1,
      color: C.text,
      fontSize: 17,
      paddingVertical: 0,
      fontFamily: FONT,
      fontWeight: "400",
      letterSpacing: 0.2,
    },
    clearIcon: {
      color: C.textMuted,
      fontSize: 14,
      paddingLeft: 8,
    },

    heroWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: HERO_TOP_GAP,
      marginBottom: 18,
    },
    hero: {
      width: HERO_SIZE,
      height: HERO_SIZE,
      borderRadius: 10,
      resizeMode: "cover",
      backgroundColor: C.surface,
      // ✅ no Android `elevation` here — elevation can make the image paint
      //    over other views. iOS shadow only.
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
    },

    titleBlock: { marginBottom: 18 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    title: {
      color: C.text,
      fontSize: 20, // same size as ownerName
      fontWeight: "500",
      letterSpacing: -0.3,
      fontFamily: FONT,
    },
    titleStar: {
      color: C.text,
      opacity: 0.75,
      fontSize: 14,
      marginRight: 10,
    },
    ownerName: {
      color: C.text,
      fontSize: 20,
      fontWeight: "500",
      fontFamily: FONT,
      textAlign: "center",
      marginTop: 2,
      letterSpacing: -0.3,
    },

    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      marginBottom: 22,
    },
    circleBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.field,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    plusText: {
      color: C.text,
      fontSize: 28,
      fontWeight: "400",
      lineHeight: 32,
      fontFamily: FONT,
      includeFontPadding: false,
    },
    playBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 56,
      height: 52,
      borderRadius: 26,
      gap: 8,
    },
    playText: {
      fontSize: 16,
      fontWeight: "600",
      fontFamily: FONT,
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.divider,
      marginLeft: 0,
      marginRight: DIVIDER_RIGHT,
    },

    songRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 6,
      paddingVertical: 5,
    },
    starHit: {
      paddingLeft: 0,
      paddingRight: 4,
      paddingVertical: 4,
    },
    star: { color: C.text, fontSize: 16 },
    starActive: { color: "#FFC107" },

    artWrap: { marginLeft: 0 },
    art: {
      width: 46,
      height: 46,
      borderRadius: 7,
      backgroundColor: C.surface,
    },
    artFallback: { alignItems: "center", justifyContent: "center" },
    artFallbackText: { color: C.textMuted, fontSize: 18 },

    songInfo: { flex: 1, marginLeft: 10, marginRight: 6 },
    songTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: "500",
      fontFamily: FONT,
    },
    songArtist: {
      color: C.textSecondary,
      fontSize: 12,
      marginTop: 2,
      fontWeight: "400",
      fontFamily: FONT,
    },

    dotsHit: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: 4,
      marginLeft: 12,
    },
    moreIcon: { width: 20, height: 20 },

    songSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.rowDivider,
      marginLeft: DIVIDER_LEFT,
      marginRight: DIVIDER_RIGHT,
    },

    songBottomDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.rowDivider,
      marginLeft: 0,
      marginRight: DIVIDER_RIGHT,
    },
    footerInfoRow: {
      paddingLeft: 20,
      paddingRight: DIVIDER_RIGHT,
      paddingTop: 12,
      paddingBottom: 6,
      alignItems: "flex-start",
    },
    footerInfoText: {
      color: C.text,
      fontSize: 16,
      fontWeight: "500",
      fontFamily: FONT,
      letterSpacing: 0.2,
    },

    empty: {
      alignItems: "center",
      paddingTop: 70,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      color: C.text,
      fontSize: 18,
      fontWeight: "600",
      fontFamily: FONT,
    },

    bottomArea: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "transparent",
    },

    modalRoot: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "transparent", // no dim overlay behind popups
    },
    bottomSheet: {
      backgroundColor: C.surface,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    sheetHandle: {
      width: 42,
      height: 5,
      borderRadius: 4,
      backgroundColor: C.textMuted,
      alignSelf: "center",
      marginBottom: 18,
    },
    sheetTitle: {
      color: C.text,
      fontSize: 17,
      fontWeight: "600",
      marginBottom: 12,
      fontFamily: FONT,
    },
    option: {
      minHeight: 52,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    optionText: {
      color: C.text,
      fontSize: 16,
      fontWeight: "400",
      fontFamily: FONT,
    },
    cancelButton: {
      marginTop: 8,
      paddingVertical: 14,
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    cancelText: {
      color: C.textSecondary,
      fontSize: 16,
      fontWeight: "400",
      fontFamily: FONT,
    },

    noPlaylists: {
      color: C.textSecondary,
      fontSize: 14,
      fontWeight: "400",
      paddingVertical: 20,
      textAlign: "center",
      fontFamily: FONT,
    },
    playlistPick: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
    },
    plIcon: {
      width: 44,
      height: 44,
      borderRadius: 9,
      backgroundColor: C.surfaceLight,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    plIconText: { color: C.textSecondary, fontSize: 18 },

    popupSheet: {
      backgroundColor: POPUP_BG,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    },
    popupHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    popupArtWrap: {
      width: 80,
      height: 80,
      alignItems: "center",
      justifyContent: "center",
    },
    popupPlayCircle: {
      position: "absolute",
      width: 38,
      height: 38,
      borderRadius: 18,
      backgroundColor: "rgba(177, 171, 171, 0.4)", // white, transparent
      alignItems: "center",
      justifyContent: "center",
    },
    popupPlayIcon: { width: 20, height: 20 },
    popupArt: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: "#2c2c2e",
    },
    popupHeaderText: { flex: 1, marginLeft: 16 },
    popupTitle: {
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "600",
      fontFamily: FONT,
    },
    popupUsername: {
      color: "#a1a1aa",
      fontSize: 14,
      marginTop: 2,
      fontFamily: FONT,
    },
    popupDivider: {
      height: StyleSheet.hairlineWidth * 2,
      backgroundColor: "#3a3a3c",
      marginBottom: 4,
    },
    popupRow: {
      paddingVertical: 14,
      paddingHorizontal: 4,
    },
    popupRowWithIcon: {
      flexDirection: "row",
      alignItems: "center",
    },
    popupRowTextIcon: { marginLeft: 14 },
    popupRowNoIcon: { paddingLeft: 42 },
    popupRowText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "400",
      fontFamily: FONT,
    },

    multiSelectHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    selectRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
    },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: C.textMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    checkCircleInner: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: C.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    checkText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
    selectArt: {
      width: 44,
      height: 44,
      borderRadius: 7,
      backgroundColor: C.surfaceLight,
      marginRight: 12,
    },
    selectInfo: { flex: 1, minWidth: 0 },
    selectTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: "500",
      fontFamily: FONT,
    },
    selectArtist: {
      color: C.textSecondary,
      fontSize: 12,
      marginTop: 2,
      fontFamily: FONT,
    },
    multiSelectFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      marginTop: 10,
    },
    cancelMultiBtn: { paddingVertical: 12, paddingHorizontal: 16 },
    addSelectedBtn: {
      backgroundColor: C.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
    },
    addSelectedText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "600",
      fontFamily: FONT,
    },
  });