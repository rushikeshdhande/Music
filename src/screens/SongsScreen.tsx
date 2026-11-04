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
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  Image,
  Pressable,
  Animated,
  Easing,
  PanResponder,
  useWindowDimensions,
  FlatList,
} from "react-native";
import * as MediaLibrary from "expo-media-library/legacy";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import TrackPlayer from 'react-native-track-player';
import { useTheme } from "../hooks/useTheme";
import { useMediaStore } from "../store/mediaStore";
import { usePlayerStore } from "../store/playerStore";
import { useMediaScanner } from "../hooks/useMediaScanner";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useArtworkCache } from "../hooks/useArtworkCache";
import { showToast } from "../utils/toast";
import { Song } from "../types";
import { PlayIcon, ShuffleIcon, PinSongIcon } from "../icons/Icons";

// ✅ Shared header (top bar + title + search)
import LibraryPageHeaders from "../components/LibraryPageHeaders";

// ✅ Shared centered loader
import { ScreenLoader } from "../components/Loader";
import {
  setupDeleteNotificationChannel,
  registerDeleteNotificationEvents,
  showDeleteWaiting,
  showDeleteProgress,
  showDeleteSuccess,
  showDeleteFailed,
  dismissDeleteNotification,
  isDeleteCancelled,
} from "../services/notifications/deleteNotificationService";

const SERIF = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

const MIN_REFRESH_MS = 800;
const MIN_BOOT_LOADER_MS = 320;
const ART_GRACE_MS = 700;
const MAX_LOADER_MS = 6000;

const PINNED_FILE = (FileSystem.documentDirectory ?? "") + "pinned_songs.json";

const LIST_ICON = require("../../assets/images/list.png");

const FONT = "sans-serif";
const ACTION_BG = "#1c1c1e";
const ACTION_RADIUS = 26;
const ACTION_HEIGHT = 52;
const ACTION_TOP_GAP = 22;

const MUSIC_DEFAULT_PNG = require("../../assets/images/musicdefault.png");

const ART_RADIUS = 6;
const ART_BORDER_WIDTH = 0.5;
const ART_BORDER_COLOR = "rgba(255,255,255,0.3)";

const cmp = (a?: string, b?: string) =>
  (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });

const UNKNOWN_ARTIST = "Unknown artist";
const UNKNOWN_ALBUM = "Unknown album";

const SHOW_DUMMY_SONGS = false;
const DUMMY_SONGS: any[] = [];

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const isDummy = (id?: string | null) => !!id && id.startsWith("dummy-");

// ── site-name cleaner (kept identical) ─────────────────────────────
const SITE_WORDS = [
  "pagalnew",
  "pagalworld",
  "pagalfree",
  "pagalmovies",
  "pagalsong",
  "pagal",
  "djmaza",
  "mrjatt",
  "mr-jatt",
  "songspk",
  "wapking",
  "webmusic",
  "djpunjab",
  "djjohal",
  "mp3mad",
  "mp3song",
  "mymp3song",
  "freshmaza",
  "musicmaza",
  "raagsong",
  "bollywoodmp3",
  "djyoungster",
  "jiosaavn",
  "hungama",
  "gaana",
  "downloadming",
  "songsmp3",
  "sensongsmp3",
  "pendujatt",
  "jattmp3",
  "newmp3",
  "mp3 download",
  "free download",
];
const SITE_WORDS_RE = SITE_WORDS.map((w) =>
  w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"),
).join("|");
const TLDS =
  "com|net|org|in|co|se|pk|info|me|cc|ws|xyz|club|site|live|fm|mobi|io|app|top|online|tv|biz|us|uk";
const SEP = "[\\s_\\-–—|:@~•·]";

const RE_BRACKET_SITE = new RegExp(
  `[\\(\\[\\{<][^\\)\\]\\}>]*(?:${SITE_WORDS_RE}|\\.(?:${TLDS})\\b)[^\\)\\]\\}>]*[\\)\\]\\}>]`,
  "gi",
);
const RE_SITE_WORD = new RegExp(
  `${SEP}*(?:${SITE_WORDS_RE})(?:\\.[a-z0-9]+)*`,
  "gi",
);
const RE_WWW = /\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const RE_DOMAIN = new RegExp(
  `${SEP}*\\b[a-z0-9-]+\\.(?:${TLDS})(?:\\.[a-z]{2})?\\b`,
  "gi",
);
const RE_EDGE_SEP = new RegExp(`^${SEP}+|${SEP}+$`, "g");

const cleanSiteName = (raw?: string | null, keepOriginal = true): string => {
  if (!raw) return "";
  const original = String(raw).trim();
  if (!original) return "";

  let s = original
    .replace(RE_BRACKET_SITE, " ")
    .replace(RE_WWW, " ")
    .replace(RE_SITE_WORD, " ")
    .replace(RE_DOMAIN, " ")
    .replace(/_/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(RE_EDGE_SEP, "")
    .trim();

  if (!s) return keepOriginal ? original : "";
  return s;
};

const isUnknownArtist = (a?: string | null): boolean => {
  if (!a) return true;
  const t = a.trim();
  if (!t) return true;
  return /^<?\s*unknown(\s+artist)?\s*>?$/i.test(t);
};

// ── ID3 reading (kept identical) ───────────────────────────────────
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

const parseId3Album = (b: Uint8Array): string | undefined =>
  readId3Frame(b, ["TALB", "TAL"]);

const parseId3Title = (b: Uint8Array): string | undefined =>
  readId3Frame(b, ["TIT2", "TT2"]);

const readTagsFromFile = async (
  uri: string,
): Promise<{ title?: string; artist?: string; album?: string }> => {
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

const EllipsisVerticalIcon = ({
  size = 22,
  color = "#000",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fill={color}
      d="M12 3C10.9 3 10 3.9 10 5C10 6.1 10.9 7 12 7C13.1 7 14 6.1 14 5C14 3.9 13.1 3 12 3ZM12 17C10.9 17 10 17.9 10 19C10 20.1 10.9 21 12 21C13.1 21 14 20.1 14 19C14 17.9 13.1 17 12 17ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
    />
  </Svg>
);

const PinIcon = ({
  size = 14,
  color = "#000",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fill={color}
      d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"
    />
  </Svg>
);

const ICON_PLAY = "M8 5v14l11-7z";
const ICON_NEXT = require("../../assets/images/Playnext.png");
const ICON_QUEUE =
  "M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z";
const ICON_PIN =
  "M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z";
const ICON_HEART = require("../../assets/images/favourite.png");
const ICON_HEART_OUTLINE = require("../../assets/images/notstar.png");
const ICON_DELETE =
  "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z";

const SheetIcon = ({
  d,
  size = 22,
  color = "#000",
}: {
  d: string;
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path fill={color} d={d} />
  </Svg>
);

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

function ArtworkBox({
  uri,
  size,
  radius = 6,
  fallbackBg,
  width,
  height,
  reloadKey = 0,
  borderWidth = 0,
  borderColor = "transparent",
}: {
  uri?: string;
  size: number;
  radius?: number;
  iconSize?: number;
  fallbackBg: string;
  iconColor: string;
  width?: number;
  height?: number;
  reloadKey?: number;
  borderWidth?: number;
  borderColor?: string;
}) {
  return (
    <SafeImage
      uri={uri}
      reloadKey={reloadKey}
      style={{
        width: width ?? size,
        height: height ?? size,
        borderRadius: radius,
        backgroundColor: fallbackBg,
        borderWidth,
        borderColor,
      }}
    />
  );
}

export default function SongsScreen() {
  const theme = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  const isDark = theme.mode === "dark";

  const BG_COLOR = theme.background;
  const SURFACE_COLOR = theme.surface;
  const BORDER_COLOR = theme.border;
  const ACCENT = theme.primary;

  const DIVIDER_COLOR = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)";

  const songs = useMediaStore((s) => s.songs ?? []);
  const favorites = useMediaStore((s) => s.favoritesSong);
  const toggleFavorite = useMediaStore((s) => s.toggleSongFavorite);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlayerPlaying = usePlayerStore((s) => s.isPlaying);

  const { scanAll } = useMediaScanner();
    const audio = useAudioPlayer() as any;
  const { loadAndPlay } = audio;
  const { artworkMap, remove: removeArtwork } = useArtworkCache(songs);

  const artKeep = useRef<Record<string, string>>({});
  useEffect(() => {
    Object.keys(artworkMap).forEach((id) => {
      const uri = artworkMap[id];
      if (uri) artKeep.current[id] = uri;
    });
  }, [artworkMap]);

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(songs.length === 0);
  const [reloadKey, setReloadKey] = useState(0);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [tagData, setTagData] = useState<
    Record<string, { title?: string; artist?: string; album?: string }>
  >({});
  const requestedTagIds = useRef<Set<string>>(new Set());
  const mounted = useRef(true);
  const refreshBusy = useRef(false);
  const initialScanStarted = useRef(false);

  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [artLoaded, setArtLoaded] = useState(false);

  const [bootMinDone, setBootMinDone] = useState(false);
  useEffect(() => {
    if (MIN_BOOT_LOADER_MS <= 0) {
      setBootMinDone(true);
      return;
    }
    const t = setTimeout(() => setBootMinDone(true), MIN_BOOT_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (songs.length === 0) return;
    const t = setTimeout(() => {
      if (mounted.current) {
        setTagsLoaded(true);
        setArtLoaded(true);
      }
    }, MAX_LOADER_MS);
    return () => clearTimeout(t);
  }, [songs.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tagsLoaded || artLoaded) return;

    const allHaveArt =
      songs.length > 0 &&
      songs.every(
        (s) => (s as any).artwork || artworkMap[s.id] || artKeep.current[s.id],
      );
    if (allHaveArt) {
      setArtLoaded(true);
      return;
    }

    const t = setTimeout(() => {
      if (mounted.current) setArtLoaded(true);
    }, ART_GRACE_MS);
    return () => clearTimeout(t);
  }, [tagsLoaded, artLoaded, songs, artworkMap]);

  const dropdownScale = useRef(new Animated.Value(0.9)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const menuClosing = useRef(false);

  const [pinnedIds, setPinnedIds] = useState<Record<string, boolean>>({});
  const pinnedLoaded = useRef(false);

  useEffect(() => {
    if (!menuVisible) return;

    menuClosing.current = false;
    dropdownScale.setValue(0.9);
    dropdownOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(dropdownScale, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dropdownOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [menuVisible, dropdownScale, dropdownOpacity]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setupDeleteNotificationChannel().catch(() => {});
    registerDeleteNotificationEvents();
  }, []);

  const openMenu = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const closeMenu = useCallback(() => {
    if (menuClosing.current) return;
    menuClosing.current = true;

    Animated.parallel([
      Animated.timing(dropdownScale, {
        toValue: 0.94,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(dropdownOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      menuClosing.current = false;
      setMenuVisible(false);
    });
  }, [dropdownScale, dropdownOpacity]);

  useEffect(() => {
    if (initialScanStarted.current) return;
    initialScanStarted.current = true;

    if (songs.length > 0) {
      setScanning(false);
      return;
    }

    setScanning(true);
    scanAll()
      .catch((error) => {
        console.error("[SongsScreen] Initial scan failed:", error);
      })
      .finally(() => {
        if (mounted.current) setScanning(false);
      });
  }, []);

  useEffect(() => {
    if (songs.length > 0) setScanning(false);
  }, [songs.length]);

  useEffect(() => {
    if (songs.length === 0) return;

    const missing = songs.filter((s) => !requestedTagIds.current.has(s.id));

    if (missing.length === 0) {
      if (mounted.current) setTagsLoaded(true);
      return;
    }

    missing.forEach((s) => requestedTagIds.current.add(s.id));

    (async () => {
      let batch: Record<
        string,
        { title?: string; artist?: string; album?: string }
      > = {};
      let count = 0;

      const flush = () => {
        if (Object.keys(batch).length > 0 && mounted.current) {
          const toSave = batch;
          setTagData((prev) => ({ ...prev, ...toSave }));
        }
        batch = {};
      };

      for (const s of missing) {
        if (!mounted.current) return;

        const uri = (s as any).uri ?? (s as any).path;
        if (uri) {
          const { title, artist, album } = await readTagsFromFile(uri);
          if (title || artist || album) {
            batch[s.id] = { title, artist, album };
          }
        }

        count++;
        if (count % 10 === 0) flush();
      }

      flush();
      if (mounted.current) setTagsLoaded(true);
    })();
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const allSongs = [...songs, ...(SHOW_DUMMY_SONGS ? DUMMY_SONGS : [])];

    let list = allSongs.map((song) => {
      const rawArtist = cleanSiteName((song as any).artist, false);
      const rawAlbum = cleanSiteName((song as any).album, false);
      const tagged = tagData[song.id];

      const taggedArtist = cleanSiteName(tagged?.artist, false);
      const artist = !isUnknownArtist(taggedArtist)
        ? taggedArtist
        : !isUnknownArtist(rawArtist)
          ? rawArtist
          : UNKNOWN_ARTIST;

      const album =
        cleanSiteName(tagged?.album, false) || rawAlbum || UNKNOWN_ALBUM;

      return {
        ...song,
        title:
          cleanSiteName(tagged?.title) ||
          cleanSiteName(song.title) ||
          ((song as any).filename
            ? cleanSiteName(
                String((song as any).filename).replace(/\.[^/.]+$/, ""),
              )
            : "") ||
          "Unknown song",
        artist,
        album,
        artwork:
          (song as any).artwork ??
          artworkMap[song.id] ??
          artKeep.current[song.id],
      };
    });

    if (query) {
      list = list.filter((song) =>
        `${song.title} ${song.artist} ${song.album}`
          .toLowerCase()
          .includes(query),
      );
    }

    return [...list].sort((a, b) => {
      const pa = pinnedIds[a.id] ? 0 : 1;
      const pb = pinnedIds[b.id] ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return cmp(a.title, b.title);
    });
  }, [songs, search, artworkMap, tagData, pinnedIds]);

  const onRefresh = useCallback(async () => {
    if (refreshBusy.current) return;
    refreshBusy.current = true;
    setRefreshing(true);

    const started = Date.now();

    try {
      requestedTagIds.current.clear();
      await scanAll();

      const wait = MIN_REFRESH_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      if (mounted.current) {
        setReloadKey((k) => k + 1);
        showToast("Library refreshed");
      }
    } catch (error) {
      console.error("[SongsScreen] Refresh failed:", error);
      if (mounted.current) showToast("Unable to scan audio files");
    } finally {
      refreshBusy.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [scanAll]);

  const playSong = useCallback(
    async (song: Song) => {
      if (isDummy(song.id)) {
        showToast("Dummy song — can't be played");
        return;
      }

      const playable = filteredSongs;
      const index = playable.findIndex((item) => item.id === song.id);

      if (index < 0) {
        showToast("Song unavailable — please scan again");
        return;
      }

      try {
        await loadAndPlay(playable, index);
      } catch (error) {
        console.error("[SongsScreen] Playback error:", error);
        showToast("Playback failed. Check logs.");
      }
    },
    [filteredSongs, loadAndPlay],
  );

  const playAll = useCallback(
    async (shuffle: boolean) => {
      if (actionBusy) return;

      const playable = filteredSongs;
      if (playable.length === 0) {
        showToast("No songs to play");
        return;
      }

      const queue = shuffle ? shuffleArray(playable) : playable;

      try {
        await loadAndPlay(queue, 0);
      } catch (error) {
        console.error("[SongsScreen] Playback error:", error);
        showToast("Playback failed. Check logs.");
      }
    },
    [filteredSongs, loadAndPlay, actionBusy],
  );

  const performDelete = useCallback(
    async (song: Song) => {
      setActionBusy(true);

      let cancelled = false;
      let deleteStarted = false;

      try {
        await dismissDeleteNotification();

        const uri = (song as any).uri ?? (song as any).path;
        let fileSizeBytes = 0;

        try {
          if (uri) {
            const info = await FileSystem.getInfoAsync(uri);
            if (info.exists && typeof (info as any).size === "number") {
              fileSizeBytes = (info as any).size;
            }
          }
        } catch (error) {
          console.warn("[SongsScreen] File size lookup failed:", error);
        }

        if (fileSizeBytes <= 0 && typeof (song as any).fileSize === "number") {
          fileSizeBytes = (song as any).fileSize;
        }

        const fileSizeMB = fileSizeBytes / (1024 * 1024);

        const onCancel = (): boolean => {
          if (deleteStarted) {
            showToast("Deletion already in progress");
            return false;
          }
          cancelled = true;
          showToast("Delete cancelled");
          return true;
        };

        await showDeleteWaiting({
          songTitle: song.title,
          fileSizeMB,
          onCancel,
        });

        if (cancelled || isDeleteCancelled()) {
          await dismissDeleteNotification();
          return;
        }

        deleteStarted = true;

        try {
          const deleted = await MediaLibrary.deleteAssetsAsync([song.id]);

          if (deleted === false) {
            await dismissDeleteNotification();
            showToast("Delete cancelled");
            return;
          }
        } catch (error: any) {
          const msg = String(error?.message ?? error);
          const denied =
            /permission/i.test(msg) && /(grant|denied|allow|write)/i.test(msg);

          if (isDeleteCancelled() || denied) {
            await dismissDeleteNotification();
            showToast("Delete cancelled");
            return;
          }

          console.error("[SongsScreen] Delete failed:", error);
          await showDeleteFailed({
            songTitle: song.title,
            fileSizeMB,
            reason: msg,
          });
          showToast("Delete failed — try again");
          return;
        }

        await showDeleteSuccess({
          songTitle: song.title,
          fileSizeMB,
        });

        removeArtwork(song.id);
        delete artKeep.current[song.id];

        // 🔥 FIX 1: Instantly update MediaStore
        const store = useMediaStore.getState() as any;
        const nextSongs = (store.songs || []).filter((s: any) => String(s.id) !== String(song.id));
        const nextFav = { ...(store.favoritesSong || {}) };
        delete nextFav[song.id];
        useMediaStore.setState({ songs: nextSongs, favoritesSong: nextFav });

          // 🔥 FIX: Instantly update PlayerStore and stop audio
                // 🔥 FIX: Instantly update PlayerStore and stop native background audio
              // 🔥 FIX: Instantly update PlayerStore and stop native background audio
        try {
          const ps: any = usePlayerStore.getState();
          if (ps?.currentTrack && String(ps.currentTrack.id) === String(song.id)) {
            
            // Force native TrackPlayer to stop and clear the queue
            try {
              await TrackPlayer.reset(); 
            } catch (e) {
              console.log("TrackPlayer reset error:", e);
            }

            // Fallback to hook methods
            try { await audio?.stop?.(); } catch (e) {}
            try { await audio?.pause?.(); } catch (e) {}
            
            // Clear React Store
            if (typeof ps.setCurrentTrack === "function") ps.setCurrentTrack(null);
            if (typeof ps.setIsPlaying === "function") ps.setIsPlaying(false);
            if (typeof ps.clearQueue === "function") ps.clearQueue();
          } else if (Array.isArray(ps.queue)) {
            const newQueue = ps.queue.filter((s: any) => String(s.id) !== String(song.id));
            if (typeof ps.setQueue === "function") ps.setQueue(newQueue);
          }
        } catch (e) {
          console.warn("[SongsScreen] Failed to reset player:", e);
        }

        // 🔥 FIX 3: Run scan in background (don't await)
        scanAll().catch((scanError: any) => {
          console.error("[SongsScreen] Scan after delete failed:", scanError);
        });

        showToast("Deleted successfully");
        setSelectedSong(null);
      } catch (error) {
        console.error("[SongsScreen] Delete workflow error:", error);
        await dismissDeleteNotification();
        showToast("Something went wrong while deleting");
      } finally {
        setActionBusy(false);
      }
    },
    [scanAll, removeArtwork],
  );
  const deleteSong = useCallback(() => {
    const song = selectedSong;
    if (!song || actionBusy) return;
    if (isDummy(song.id)) {
      showToast("Dummy song — can't be deleted");
      return;
    }

    Alert.alert(
      "Delete song?",
      `Delete "${song.title}" from your device? Android may ask you to approve the deletion.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => performDelete(song),
        },
      ],
    );
  }, [selectedSong, actionBusy, performDelete]);

  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(PINNED_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(PINNED_FILE);
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && mounted.current) {
            const map: Record<string, boolean> = {};
            arr.forEach((id: any) => {
              map[String(id)] = true;
            });
            setPinnedIds(map);
          }
        }
      } catch {
        // ignore
      } finally {
        pinnedLoaded.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!pinnedLoaded.current) return;
    FileSystem.writeAsStringAsync(
      PINNED_FILE,
      JSON.stringify(Object.keys(pinnedIds)),
    ).catch(() => {});
  }, [pinnedIds]);

  const togglePin = useCallback((song: Song) => {
    setPinnedIds((prev) => {
      const next = { ...prev };
      if (next[song.id]) {
        delete next[song.id];
        showToast("Unpinned");
      } else {
        next[song.id] = true;
        showToast("Pinned to top");
      }
      return next;
    });
  }, []);

  const playNext = useCallback(
    (song: Song) => {
      if (isDummy(song.id)) {
        showToast("Dummy song — can't be queued");
        return;
      }
      const st: any = usePlayerStore.getState();
      if (!st.currentTrack) {
        playSong(song);
        return;
      }
      if (st.currentTrack.id === song.id) {
        showToast("Already playing");
        return;
      }
      if (typeof st.playNext === "function") {
        st.playNext(song);
        showToast("Will play next");
        return;
      }
      if (Array.isArray(st.queue) && typeof st.setQueue === "function") {
        const without = st.queue.filter((q: any) => q.id !== song.id);
        const at = without.findIndex((q: any) => q.id === st.currentTrack.id);
        const next = [...without];
        next.splice(at + 1, 0, song);
        st.setQueue(next);
        showToast("Will play next");
        return;
      }
      showToast("Play Next is not supported yet");
    },
    [playSong],
  );

  const addToQueue = useCallback(
    (song: Song) => {
      if (isDummy(song.id)) {
        showToast("Dummy song — can't be queued");
        return;
      }
      const st: any = usePlayerStore.getState();
      if (!st.currentTrack) {
        playSong(song);
        return;
      }
      const fn = st.addToQueue ?? st.enqueue;
      if (typeof fn === "function") {
        fn(song);
        showToast("Added to queue");
        return;
      }
      if (Array.isArray(st.queue) && typeof st.setQueue === "function") {
        if (st.queue.some((q: any) => q.id === song.id)) {
          showToast("Already in queue");
          return;
        }
        st.setQueue([...st.queue, song]);
        showToast("Added to queue");
        return;
      }
      showToast("Add to Queue is not supported yet");
    },
    [playSong],
  );

  const sheetY = useRef(new Animated.Value(winH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetDrag = useRef(new Animated.Value(0)).current;
  const sheetHRef = useRef(winH);
  const sheetShown = useRef(false);
  const sheetClosing = useRef(false);

  const resetSheet = useCallback(() => {
    sheetShown.current = false;
    sheetClosing.current = false;
    sheetY.setValue(winH);
    backdropAnim.setValue(0);
    sheetDrag.setValue(0);
  }, [winH, sheetY, backdropAnim, sheetDrag]);

  useEffect(() => {
    if (!selectedSong) resetSheet();
  }, [selectedSong, resetSheet]);

  const sheetPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          sheetDrag.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 100 || g.vy > 0.8) {
            if (sheetClosing.current) return;
            sheetClosing.current = true;
            Animated.timing(sheetDrag, {
              toValue: winH,
              duration: 200,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }).start(() => {
              resetSheet();
              setSelectedSong(null);
            });
          } else {
            Animated.timing(sheetDrag, {
              toValue: 0,
              duration: 180,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.timing(sheetDrag, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }).start();
        },
      }),
    [winH, sheetDrag, resetSheet],
  );

  const onSheetLayout = useCallback(
    (e: any) => {
      const h = e.nativeEvent.layout.height;
      if (h <= 0) return;
      sheetHRef.current = h;
      if (!selectedSong || sheetShown.current) return;

      sheetShown.current = true;
      sheetClosing.current = false;
      sheetDrag.setValue(0);
      sheetY.setValue(h);
      backdropAnim.setValue(0);

      Animated.parallel([
        Animated.timing(sheetY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [selectedSong, sheetY, backdropAnim, sheetDrag],
  );

  const closeSheet = useCallback(
    (after?: () => void) => {
      if (sheetClosing.current) return;
      sheetClosing.current = true;
      Animated.parallel([
        Animated.timing(sheetY, {
          toValue: sheetHRef.current + 24,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        resetSheet();
        setSelectedSong(null);
        after?.();
      });
    },
    [sheetY, backdropAnim, resetSheet],
  );

  const renderSong = useCallback(
    ({ item }: { item: any }) => {
      const isFav = !!favorites[item.id];
      const isPinned = !!pinnedIds[item.id];

      const isPlaying = currentTrack?.id === item.id && isPlayerPlaying;

      const artwork = item.artwork;
      const artistName = item.artist || UNKNOWN_ARTIST;

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => playSong(item)}
          onLongPress={() => setSelectedSong(item)}
          style={styles.listRow}
        >
          {isPlaying && (
            <View pointerEvents="none" style={styles.playingDotWrap}>
              <View
                style={[
                  styles.playingDot,
                  { backgroundColor: "rgba(255,255,255,0.4)" },
                ]}
              />
            </View>
          )}

          <ArtworkBox
            uri={artwork}
            size={52}
            radius={ART_RADIUS}
            borderWidth={ART_BORDER_WIDTH}
            borderColor={ART_BORDER_COLOR}
            reloadKey={reloadKey}
            fallbackBg={SURFACE_COLOR}
            iconColor={theme.textSecondary}
          />

          <View style={styles.listInfo}>
            <Text
              numberOfLines={1}
              style={[styles.listTitle, { color: theme.text }]}
            >
              {item.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.listArtist, { color: theme.textSecondary }]}
            >
              {artistName}
            </Text>
          </View>

          {isPinned && (
            <View style={styles.listPin}>
              <PinIcon size={13} color={theme.textSecondary} />
            </View>
          )}

          {isFav && (
            <Text style={[styles.listFavStar, { color: ACCENT }]}>★</Text>
          )}

          <TouchableOpacity
            onPress={() => setSelectedSong(item)}
            style={styles.listMoreBtn}
            hitSlop={10}
          >
            <EllipsisVerticalIcon size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [
      favorites,
      pinnedIds,
      currentTrack,
      isPlayerPlaying,
      playSong,
      theme,
      SURFACE_COLOR,
      ACCENT,
      BORDER_COLOR,
      reloadKey,
    ],
  );

  const contentReady = tagsLoaded && artLoaded;
  const showLoading =
    !bootMinDone ||
    (scanning && songs.length === 0) ||
    (songs.length > 0 && !contentReady);

  const contentStyle =
    filteredSongs.length === 0 ? styles.emptyContainer : styles.listContent;

  // ✅ Only the Play/Shuffle action row remains in the list header.
  //    Title + search now live in the shared LibraryPageHeaders.
  const listHeader = (
    <View style={styles.headerSection}>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.75}
          onPress={() => playAll(false)}
        >
          <PlayIcon size={20} color={ACCENT} />
          <Text style={[styles.actionLabel, { color: ACCENT }]}>Play</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.75}
          onPress={() => playAll(true)}
        >
          <ShuffleIcon size={20} color={ACCENT} />
          <Text style={[styles.actionLabel, { color: ACCENT }]}>Shuffle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: BG_COLOR }]}>
      {/* ---------- SHARED HEADER (top bar + title + search) ---------- */}
      <LibraryPageHeaders
        colors={theme}
        topInset={insets.top}
        title="Songs"
        onBack={() => nav.goBack()}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search songs, artists, albums"
        actions={[
          {
            key: "menu",
            icon: LIST_ICON,
            iconStyle: { width: 23, height: 20 },
            onPress: openMenu,
          },
        ]}
      />

      <View
        style={[styles.listWrap, { opacity: showLoading ? 0 : 1 }]}
        pointerEvents={showLoading ? "none" : "auto"}
      >
        <FlatList
          key="songs-list"
          data={filteredSongs}
          ListHeaderComponent={listHeader}
          extraData={reloadKey}
          keyExtractor={(item: any) => item.id}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: BG_COLOR }}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          alwaysBounceVertical
          showsVerticalScrollIndicator={false}
          bounces
          overScrollMode="always"
          nestedScrollEnabled
          renderItem={renderSong}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 0.8,
                backgroundColor: DIVIDER_COLOR,
                marginLeft: 84,
                marginRight: 0,
              }}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
              colors={[ACCENT]}
              progressBackgroundColor={SURFACE_COLOR}
              progressViewOffset={Platform.OS === "android" ? 8 : 0}
            />
          }
          contentContainerStyle={contentStyle}
          ListEmptyComponent={
            <View style={styles.empty}>
              {songs.length === 0 ? (
                <>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    No songs found
                  </Text>
                  <Text
                    style={[styles.emptyText, { color: theme.textSecondary }]}
                  >
                    Pull down to scan your device again.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    No matching songs
                  </Text>
                  <Text
                    style={[styles.emptyText, { color: theme.textSecondary }]}
                  >
                    Try another song or artist name.
                  </Text>
                </>
              )}
            </View>
          }
        />
      </View>

      <ScreenLoader visible={showLoading} />

      {/* ---- Header dropdown — Settings & Account only (unchanged) ---- */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.dropdownBackdrop} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.dropdownCard,
              {
                backgroundColor: SURFACE_COLOR,
                borderColor: BORDER_COLOR,
                shadowColor: "#000",
                shadowOpacity: isDark ? 0.45 : 0.18,
                top: insets.top + 44,
                right: 10,
                opacity: dropdownOpacity,
                transform: [{ scale: dropdownScale }],
                transformOrigin: "top right",
              } as any,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <TouchableOpacity
                style={styles.dropdownRow}
                activeOpacity={0.7}
                onPress={() => {
                  closeMenu();
                  nav.navigate("Settings");
                }}
              >
                <Text style={[styles.dropdownItemText, { color: theme.text }]}>
                  Settings
                </Text>
              </TouchableOpacity>

              <View
                style={[styles.menuDivider, { backgroundColor: BORDER_COLOR }]}
              />

              <TouchableOpacity
                style={styles.dropdownRow}
                activeOpacity={0.7}
                onPress={() => {
                  closeMenu();
                  nav.navigate("Account");
                }}
              >
                <Text style={[styles.dropdownItemText, { color: theme.text }]}>
                  Account
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ---- Song 3-dot bottom sheet (unchanged) ---- */}
      <Modal
        visible={!!selectedSong}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeSheet()}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => closeSheet()}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(0,0,0,0.45)",
                  opacity: Animated.multiply(
                    backdropAnim,
                    sheetDrag.interpolate({
                      inputRange: [0, winH],
                      outputRange: [1, 0],
                      extrapolate: "clamp",
                    }),
                  ),
                },
              ]}
            />
          </Pressable>

          <Animated.View
            {...sheetPan.panHandlers}
            onLayout={onSheetLayout}
            style={[
              styles.sheetCard,
              {
                backgroundColor: "#1c1c1e",
                borderColor: theme.border,
                paddingBottom: insets.bottom + 8,
                transform: [{ translateY: Animated.add(sheetY, sheetDrag) }],
              },
            ]}
          >
            <View style={styles.popupHeader}>
              <ArtworkBox
                uri={
                  selectedSong
                    ? ((selectedSong as any).artwork ??
                      artworkMap[selectedSong.id] ??
                      artKeep.current[selectedSong.id])
                    : undefined
                }
                size={76}
                radius={ART_RADIUS}
                borderWidth={ART_BORDER_WIDTH}
                borderColor={ART_BORDER_COLOR}
                reloadKey={reloadKey}
                fallbackBg={BG_COLOR}
                iconColor={theme.textSecondary}
              />
              <View style={styles.popupHeaderText}>
                <Text
                  style={[styles.popupTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {selectedSong ? selectedSong.title : "Song options"}
                </Text>
                {!!(selectedSong as any)?.album &&
                  (selectedSong as any).album !== UNKNOWN_ALBUM && (
                    <Text
                      style={[styles.popupAlbum, { color: theme.primary }]}
                      numberOfLines={1}
                    >
                      {(selectedSong as any).album}
                    </Text>
                  )}
                <Text
                  style={[styles.popupSubtitle, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {selectedSong?.artist || UNKNOWN_ARTIST}
                </Text>
              </View>
            </View>

            <View
              style={[styles.popupDivider, { backgroundColor: theme.border }]}
            />

            <View style={styles.popupList}>
              {(() => {
                const song = selectedSong;
                if (!song) return null;
                const isFav = !!favorites[song.id];
                const isPinned = !!pinnedIds[song.id];

                const options: {
                  label: string;
                  icon?: string;
                  customIcon?: (color: string) => React.ReactNode;
                  destructive?: boolean;
                  onPress: () => void;
                }[] = [
                  {
                    label: isPinned ? "Unpin Song" : "Pin Song",
                    customIcon: (c) => <PinSongIcon size={26} color={c} />,
                    onPress: () => togglePin(song),
                  },
                  {
                    label: "Play Next",
                    icon: ICON_NEXT,
                    onPress: () => playNext(song),
                  },
                  {
                    label: "Add to Queue",
                    icon: ICON_QUEUE,
                    onPress: () => addToQueue(song),
                  },
                  {
                    label: isFav ? "Undo Favorite" : "Favorite",
                    customIcon: () => (
                      <Image
                        source={isFav ? ICON_HEART : ICON_HEART_OUTLINE}
                        style={{
                          width: isFav ? 22 : 28,
                          height: isFav ? 22 : 28,
                          resizeMode: "contain",
                        }}
                      />
                    ),
                    onPress: () => {
                      toggleFavorite(song.id);
                    },
                  },
                  {
                    label: "Delete Song",
                    icon: ICON_DELETE,
                    destructive: true,
                    onPress: deleteSong,
                  },
                ];

                return options.map((item) => {
                  const textColor = theme.text;
                  const iconColor = theme.primary;

                  return (
                    <View key={item.label}>
                      <TouchableOpacity
                        style={styles.popupItem}
                        activeOpacity={0.7}
                        disabled={actionBusy}
                        onPress={() => closeSheet(item.onPress)}
                      >
                        {item.customIcon ? (
                          item.customIcon(iconColor)
                        ) : item.label === "Play Next" ? (
                          <Image
                            source={ICON_NEXT}
                            style={{
                              width: 22,
                              height: 22,
                              resizeMode: "contain",
                            }}
                          />
                        ) : (
                          <SheetIcon
                            d={item.icon!}
                            size={22}
                            color={iconColor}
                          />
                        )}

                        <Text
                          style={[styles.popupItemText, { color: textColor }]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                });
              })()}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// Styles — header styles removed (now in LibraryPageHeaders)
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  headerSection: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 14 },

  actionRow: { flexDirection: "row", marginTop: ACTION_TOP_GAP },
  actionBtn: {
    flex: 1,
    height: ACTION_HEIGHT,
    borderRadius: ACTION_RADIUS,
    backgroundColor: ACTION_BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  actionLabel: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: FONT,
  },

  listWrap: { flex: 1 },

  listContent: { paddingBottom: 100 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  listInfo: { flex: 1, minWidth: 0, marginLeft: 14, marginRight: 8 },
  listTitle: { fontSize: 17, fontWeight: "600", fontFamily: SERIF },
  listArtist: { fontSize: 13.5, fontFamily: SERIF, marginTop: 0 },
  listPin: { marginLeft: 6 },
  listFavStar: { fontSize: 14, marginLeft: 4 },
  listMoreBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  playingDotWrap: {
    position: "absolute",
    left: 4,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 2,
  },
  playingDot: { width: 6, height: 6, borderRadius: 3 },

  emptyContainer: { flexGrow: 1 },
  empty: {
    flex: 1,
    minHeight: 300,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: SERIF,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: SERIF,
    textAlign: "center",
  },

  // ── Header Dropdown ──
  dropdownBackdrop: { flex: 1, backgroundColor: "transparent" },
  dropdownCard: {
    position: "absolute",
    width: 180,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    overflow: "hidden",
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    fontFamily: SERIF,
    fontWeight: "500",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },

  // ── 3-Dot Bottom Sheet ──
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetCard: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: 20,
  },
  popupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  popupHeaderText: { flex: 1, marginLeft: 16 },
  popupTitle: { fontSize: 15, fontWeight: "600", fontFamily: SERIF },
  popupAlbum: { fontSize: 15, marginTop: 3, fontFamily: SERIF },
  popupSubtitle: { fontSize: 15, marginTop: 4, fontFamily: SERIF },
  popupDivider: { height: StyleSheet.hairlineWidth },
  popupList: {},
  popupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  popupItemText: { marginLeft: 16, fontSize: 16, fontFamily: SERIF },
});