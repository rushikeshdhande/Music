// src/screens/AlbumDetailsScreen.tsx
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
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Share,
  Easing,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import Svg, { Path } from "react-native-svg";
import { getColors } from "react-native-image-colors";
import { BlurView, BlurTargetView } from "expo-blur";

// ── Components ────────────────────────────────────────────────
import { GlassIconBtn } from "../components/LibraryPageHeaders";
import { GlassBG } from "../components/GlassCard";
import { ScreenLoader } from "../components/Loader";

// ── Hooks + store ─────────────────────────────────────────────
import { useTheme } from "../hooks/useTheme";
import { useMediaStore } from "../store/mediaStore";
import { usePlayerStore } from "../store/playerStore";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useArtworkCache } from "../hooks/useArtworkCache";
import { showToast } from "../utils/toast";
import {
  PlayIcon,
  ShuffleIcon,
  PinSongIcon,
  SkipNextIcon,
} from "../icons/Icons";
import {
  getCachedTags,
  getCachedArtwork,
  hasCachedTags,
  readAndCacheTags,
  setCachedArtwork,
} from "../services/audioTags/tagService";

const FONT = "sans-serif";
const MUSIC_DEFAULT_PNG = require("../../assets/images/musicdefault.png");
const LOSSLESS_ICON = require("../../assets/icons/lossless-icon.png");
const MORE_ICON = require("../../assets/apple/moreicon.png");
const BACK_ICON = require("../../assets/icons/backicon.png");
const CREATE_PLAYLIST_ICON = require("../../assets/icons/createplaylisticona.png");

const DEFAULT_GENRE = "Bollywood";
const DEFAULT_YEAR = "2026";

const PINNED_FILE = (FileSystem.documentDirectory ?? "") + "pinned_songs.json";
const STORAGE_PLAYLISTS = "@library_playlists";

const UNKNOWN_ALBUM = "Unknown album";
const UNKNOWN_ARTIST = "Unknown artist";

const MIN_BOOT_LOADER_MS = 320;
const MAX_TAG_WAIT_MS = 3000;

const HEADER_SCROLL_DISTANCE = 180;
const HEADER_CONTENT_H = 44;

const BG_COLOR_STRENGTH = 0.65;
const COLOR_FALLBACK = "#141416";

const IS_ANDROID = Platform.OS === "android";

// Popup width — reduced from 200 → 160 for a tighter look
const POPUP_WIDTH = 160;
const HAIRLINE = StyleSheet.hairlineWidth; // 0.5 on @2x, 0.33 on @3x, 1 on mdpi

const ShareSvg = ({
  color = "#fff",
  size = 18,
}: {
  color?: string;
  size?: number;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
      fill={color}
    />
  </Svg>
);

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

const darkenIfBright = (hex: string, maxBrightness = 140): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness <= maxBrightness) return hex;
  const f = maxBrightness / brightness;
  const to = (n: number) =>
    Math.round(n * f)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
};

const cleanName = (raw?: string | null, fallback = ""): string => {
  if (!raw) return fallback;
  const s = String(raw)
    .replace(/[\(\[\{<][^\)\]\}>]*[\)\]\}>]/g, " ")
    .replace(/\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi, " ")
    .replace(
      /\b[a-z0-9-]+\.(?:com|net|org|in|co|se|pk|info|me|cc|xyz|live|fm|io|app|tv|club|site|online)\b/gi,
      " ",
    )
    .replace(/[\s_\-–—|:@~•·]+/g, " ")
    .trim();
  return s || fallback;
};

const isUnknownArtist = (a?: string | null): boolean => {
  if (!a) return true;
  return /^<?\s*unknown(\s+artist)?\s*>?$/i.test(a.trim());
};

const syncArtwork = (
  song: any,
  artworkMap: Record<string, string>,
): string | undefined =>
  song?.artwork ??
  song?.artworkUri ??
  song?.cover ??
  getCachedArtwork(song.id) ??
  artworkMap[song.id];

const formatLongDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatDurationMinutes = (totalSec: number): string => {
  if (!totalSec || totalSec < 30) return "";
  const mins = Math.round(totalSec / 60);
  if (mins < 1) return "less than 1 minute";
  return `${mins} minute${mins === 1 ? "" : "s"}`;
};

const albumKeyOf = (s: any): string => {
  const raw =
    getCachedTags(s.id)?.album ??
    (typeof s.album === "string" ? s.album : undefined);
  return cleanName(raw, UNKNOWN_ALBUM).toLowerCase();
};

export default function AlbumDetailsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const blurTargetRef = useRef<View>(null);

  const albumName: string = route.params?.albumName ?? UNKNOWN_ALBUM;
  const routeSongIds: string[] | undefined = route.params?.songIds;
  const routeArtwork: string | undefined = route.params?.artwork;

  const songs = useMediaStore((s) => s.songs ?? []);
  const favorites = useMediaStore((s) => s.favoritesSong);
  const { loadAndPlay } = useAudioPlayer();
  const { artworkMap } = useArtworkCache(songs);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [addToMode, setAddToMode] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Record<string, boolean>>({});
  const pinnedLoaded = useRef(false);
  const mounted = useRef(true);

  const [menuVisible, setMenuVisible] = useState(false);

  const [tagVersion, setTagVersion] = useState(0);
  const requestedRef = useRef<Set<string>>(new Set());

  const [bootMinDone, setBootMinDone] = useState(false);
  const [tagsLoaded, setTagsLoaded] = useState(false);

  const [bgColor, setBgColor] = useState(theme.background);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DISTANCE, HEADER_SCROLL_DISTANCE + 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DISTANCE, HEADER_SCROLL_DISTANCE + 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const blurOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  // Popup animation (safe — no transformOrigin)
  const menuScale = useRef(new Animated.Value(0.9)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuClosing = useRef(false);

  useEffect(() => {
    if (!menuVisible) return;
    menuClosing.current = false;
    menuScale.setValue(0.9);
    menuOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(menuScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(menuOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [menuVisible, menuScale, menuOpacity]);

  const closeMenu = useCallback(
    (after?: () => void) => {
      if (menuClosing.current) return;
      menuClosing.current = true;
      Animated.parallel([
        Animated.timing(menuScale, {
          toValue: 0.94,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        menuClosing.current = false;
        setMenuVisible(false);
        after?.();
      });
    },
    [menuScale, menuOpacity],
  );

  useEffect(() => {
    if (MIN_BOOT_LOADER_MS <= 0) {
      setBootMinDone(true);
      return;
    }
    const t = setTimeout(() => setBootMinDone(true), MIN_BOOT_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    Object.keys(artworkMap).forEach((id) => {
      const uri = artworkMap[id];
      if (uri) setCachedArtwork(id, uri);
    });
  }, [artworkMap]);

  const albumSongs = useMemo(() => {
    const target = cleanName(albumName, UNKNOWN_ALBUM).toLowerCase();
    const isUnknownTarget = target === UNKNOWN_ALBUM.toLowerCase();
    let list: any[];

    if (routeSongIds && routeSongIds.length > 0) {
      const idSet = new Set(routeSongIds);
      list = songs.filter((s: any) => idSet.has(s.id));

      if (!isUnknownTarget) {
        list = list.filter(
          (s: any) => !hasCachedTags(s.id) || albumKeyOf(s) === target,
        );
      }
    } else {
      list = songs.filter((s: any) => albumKeyOf(s) === target);
    }

    const sorted = [...list].sort((a: any, b: any) =>
      (a.title ?? "").localeCompare(b.title ?? "", undefined, {
        sensitivity: "base",
      }),
    );

    return sorted;
  }, [routeSongIds, songs, albumName, tagVersion]);

  useEffect(() => {
    if (albumSongs.length === 0) {
      setTagsLoaded(true);
      return;
    }

    const missing = albumSongs.filter(
      (s: any) => !hasCachedTags(s.id) && !requestedRef.current.has(s.id),
    );
    if (missing.length === 0) {
      setTagsLoaded(true);
      return;
    }

    missing.forEach((s) => requestedRef.current.add(s.id));

    let cancelled = false;
    (async () => {
      for (const s of missing) {
        if (cancelled || !mounted.current) return;
        const uri = (s as any).uri ?? (s as any).path;
        if (uri) {
          try {
            await readAndCacheTags(s.id, uri);
          } catch {}
        }
      }
      if (!cancelled && mounted.current) {
        setTagVersion((v) => v + 1);
        setTagsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [albumSongs]);

  useEffect(() => {
    if (tagsLoaded) return;
    const t = setTimeout(() => {
      if (mounted.current) setTagsLoaded(true);
    }, MAX_TAG_WAIT_MS);
    return () => clearTimeout(t);
  }, [tagsLoaded]);

  const displayTitle = (song: any): string => {
    const fromCache = getCachedTags(song.id)?.title;
    if (fromCache && String(fromCache).trim()) return cleanName(fromCache);

    const fromSong = (song as any).title;
    if (fromSong && String(fromSong).trim()) return cleanName(fromSong);

    const fromFile = (song as any).filename
      ? String((song as any).filename).replace(/\.[^/.]+$/, "")
      : "";
    return cleanName(fromFile) || "Unknown";
  };

  const displayArtist = (song: any): string => {
    const raw = getCachedTags(song.id)?.artist ?? (song as any).artist;
    const cleaned = cleanName(raw, "");
    return !isUnknownArtist(cleaned) ? cleaned : UNKNOWN_ARTIST;
  };

  const albumArtwork = useMemo(() => {
    if (routeArtwork) return routeArtwork;
    for (const s of albumSongs as any[]) {
      const a = syncArtwork(s, artworkMap);
      if (a) return a;
    }
    return undefined;
  }, [routeArtwork, albumSongs, artworkMap]);

  useEffect(() => {
    if (!albumArtwork) {
      setBgColor(theme.background);
      return;
    }

    const uri =
      albumArtwork.startsWith("http") ||
      albumArtwork.startsWith("file://") ||
      albumArtwork.startsWith("content://") ||
      albumArtwork.startsWith("data:")
        ? albumArtwork
        : `file://${albumArtwork}`;

    let isMounted = true;

    getColors(uri, {
      fallback: COLOR_FALLBACK,
      cache: true,
      key: uri,
    })
        .then((res: any) => {
        if (!isMounted) return;

        let picked: string = COLOR_FALLBACK;

        if (res?.platform === "ios") {
          picked = res.background || res.primary || COLOR_FALLBACK;
        } else {
          picked =
            res.darkVibrant ||
            res.vibrant ||
            res.dominant ||
            res.muted ||
            res.average ||
            COLOR_FALLBACK;
        }

        if (picked === "#000000" || picked === "#000") {
          picked = res.muted || res.vibrant || COLOR_FALLBACK;
        }

        // 🔥 Guard: empty / invalid colour string → fallback
        if (!picked || typeof picked !== "string" || picked.length < 4) {
          picked = COLOR_FALLBACK;
        }

        setBgColor(
          mixHex(darkenIfBright(picked), COLOR_FALLBACK, BG_COLOR_STRENGTH),
        );
      })
      .catch((e) => {
        console.log("[Album] getColors failed:", e);
        if (isMounted) setBgColor(theme.background);
      });

    return () => {
      isMounted = false;
    };
  }, [albumArtwork, theme.background]);

  const withArt = useCallback(
    (song: any) => {
      const art = syncArtwork(song, artworkMap) ?? albumArtwork;
      return art ? { ...song, artwork: art } : song;
    },
    [artworkMap, albumArtwork],
  );

  const playableSongs = useMemo(
    () => albumSongs.map((s: any) => withArt(s)),
    [albumSongs, withArt],
  );

  const isDark = theme.mode === "dark";

  const ON_BG_TEXT = "#ffffff";
  const ON_BG_SUB = "rgba(255,255,255,0.6)";
  const ON_BG_DIVIDER = "rgba(255,255,255,0.16)";

  const textColor = ON_BG_TEXT;
  const subTextColor = ON_BG_SUB;
  const accentColor = theme.iconsColour;
  const lineColor = ON_BG_DIVIDER;

  const circleBg = "rgba(255,255,255,0.15)";

  const headerColors = useMemo(
    () => ({
      background: bgColor,
      surface: theme.surface,
      border: theme.border,
      text: "#ffffff",
      textSecondary: "rgba(255,255,255,0.72)",
      textMuted: "rgba(255,255,255,0.56)",
      primary: "#ffffff",
    }),
    [theme, bgColor],
  );

  const albumGenre = useMemo(() => {
    for (const s of albumSongs as any[]) {
      const tags: any = getCachedTags(s.id);
      const raw = tags?.genre ?? s.genre;
      const g = Array.isArray(raw) ? raw[0] : raw;
      const c = cleanName(g, "");
      if (c) return c;
    }
    return DEFAULT_GENRE;
  }, [albumSongs, tagVersion]);

  const albumYear = useMemo(() => {
    for (const s of albumSongs as any[]) {
      const tags: any = getCachedTags(s.id);
      const raw = tags?.year ?? s.year;
      const m = raw ? String(raw).match(/\d{4}/) : null;
      if (m) return m[0];
    }
    return DEFAULT_YEAR;
  }, [albumSongs, tagVersion]);

  const albumArtist = useMemo(() => {
    for (const s of albumSongs as any[]) {
      const raw = getCachedTags(s.id)?.artist;
      if (raw) {
        const c = cleanName(raw, "");
        if (c && !isUnknownArtist(c)) return c;
      }
    }
    for (const s of albumSongs as any[]) {
      const c = cleanName((s as any).artist, "");
      if (c && !isUnknownArtist(c)) return c;
    }
    return UNKNOWN_ARTIST;
  }, [albumSongs, tagVersion]);

  const displayAlbumName = useMemo(() => {
    const passed = cleanName(albumName, "");
    if (passed && passed.toLowerCase() !== UNKNOWN_ALBUM.toLowerCase()) {
      return passed;
    }
    for (const s of albumSongs as any[]) {
      const raw = getCachedTags(s.id)?.album ?? (s as any).album;
      const c = cleanName(raw, "");
      if (c && c.toLowerCase() !== UNKNOWN_ALBUM.toLowerCase()) return c;
    }
    return passed || UNKNOWN_ALBUM;
  }, [albumSongs, albumName, tagVersion]);

  const albumDate = useMemo(() => {
    let newest = 0;
    for (const s of albumSongs as any[]) {
      const candidates = [
        s.dateAdded,
        s.createdAt,
        s.modificationTime,
        s.timestamp,
        s.addedAt,
      ];
      for (const c of candidates) {
        if (typeof c === "number" && Number.isFinite(c) && c > 0) {
          if (c > newest) newest = c;
        } else if (typeof c === "string") {
          const t = Date.parse(c);
          if (!isNaN(t) && t > newest) newest = t;
        }
      }
    }
    return newest || Date.now();
  }, [albumSongs]);

  const formattedDate = useMemo(() => formatLongDate(albumDate), [albumDate]);

  const totalDurationSec = useMemo(() => {
    let total = 0;
    for (const s of albumSongs as any[]) {
      const d = s.duration;
      if (typeof d === "number" && d > 0) {
        total += d > 36000 ? d / 1000 : d;
      }
    }
    return total;
  }, [albumSongs]);

  const songCountText = `${albumSongs.length} song${
    albumSongs.length === 1 ? "" : "s"
  }`;

  const footerCountLine = useMemo(() => {
    const dur = formatDurationMinutes(totalDurationSec);
    return dur ? `${songCountText}, ${dur}` : songCountText;
  }, [songCountText, totalDurationSec]);

  const playFrom = useCallback(
    async (index: number) => {
      if (playableSongs.length === 0) return;
      try {
        await loadAndPlay(playableSongs, index);
      } catch {
        showToast("Playback failed");
      }
    },
    [playableSongs, loadAndPlay],
  );

  const handlePlay = () => playFrom(0);

  const handleShuffle = () => {
    if (playableSongs.length === 0) return;
    const shuffled = [...playableSongs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    loadAndPlay(shuffled, 0).catch(() => showToast("Playback failed"));
  };

  const handleShareAlbum = async () => {
    try {
      await Share.share({
        message: `Check out "${displayAlbumName}" by ${albumArtist}`,
      });
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(PINNED_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(PINNED_FILE);
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const map: Record<string, boolean> = {};
            arr.forEach((id: any) => {
              map[String(id)] = true;
            });
            setPinnedIds(map);
          }
        }
      } catch {
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

  const togglePin = useCallback((song: any) => {
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

  const openAddTo = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const all = raw ? JSON.parse(raw) : [];
      setPlaylists(Array.isArray(all) ? all : []);
      setAddToMode(true);
    } catch {
      showToast("Could not load playlists");
    }
  };

  const addToPlaylist = async (pl: any) => {
    if (!selectedSong) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const all = raw ? JSON.parse(raw) : [];
      const updated = all.map((p: any) =>
        p.id === pl.id
          ? {
              ...p,
              songs: [...(p.songs ?? []), selectedSong],
              artwork:
                p.artwork ??
                (selectedSong as any).artwork ??
                albumArtwork ??
                null,
              updatedAt: Date.now(),
            }
          : p,
      );
      await AsyncStorage.setItem(STORAGE_PLAYLISTS, JSON.stringify(updated));
      showToast(`Added to "${pl.name}"`);
      setSelectedSong(null);
      setAddToMode(false);
    } catch {
      showToast("Could not add to playlist");
    }
  };

  const playNext = () => {
    if (!selectedSong) return;
    const st: any = usePlayerStore.getState();

    if (!st.currentTrack) {
      const i = albumSongs.findIndex((s: any) => s.id === selectedSong.id);
      if (i >= 0) playFrom(i);
      setSelectedSong(null);
      return;
    }
    if (st.currentTrack.id === selectedSong.id) {
      showToast("Already playing");
      setSelectedSong(null);
      return;
    }
    const withCover = withArt(selectedSong);
    if (typeof st.playNext === "function") {
      st.playNext(withCover);
      showToast("Will play next");
      setSelectedSong(null);
      return;
    }
    if (Array.isArray(st.queue) && typeof st.setQueue === "function") {
      const without = st.queue.filter((q: any) => q.id !== selectedSong.id);
      const at = without.findIndex((q: any) => q.id === st.currentTrack.id);
      const next = [...without];
      next.splice(at + 1, 0, withCover);
      st.setQueue(next);
      showToast("Will play next");
    }
    setSelectedSong(null);
  };

  useEffect(() => {
    if (!selectedSong) setAddToMode(false);
  }, [selectedSong]);

  const renderSong = ({ item, index }: { item: any; index: number }) => {
    const isFav = !!favorites[item.id];
    const isCurrent = currentTrack?.id === item.id;

    return (
      <TouchableOpacity
        style={styles.songRow}
        activeOpacity={0.7}
        onPress={() => playFrom(index)}
      >
        <View style={styles.starCol}>
          {isFav ? (
            <Text style={[styles.star, { color: accentColor }]}>★</Text>
          ) : null}
        </View>

        <Text style={[styles.count, { color: subTextColor }]}>{index + 1}</Text>

        <View style={styles.songInfo}>
          <Text
            numberOfLines={1}
            style={[
              styles.songTitle,
              { color: isCurrent ? "#ffffff" : textColor },
            ]}
          >
            {displayTitle(item)}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.songArtist, { color: subTextColor }]}
          >
            {displayArtist(item)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setSelectedSong(item)}
          hitSlop={10}
          style={styles.dotsHit}
        >
          <Image
            source={MORE_ICON}
            style={[styles.dots, { tintColor: subTextColor }]}
            resizeMode="contain"
            fadeDuration={0}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const showLoading = !bootMinDone || !tagsLoaded;

  const menuShadow = isDark
    ? { color: "#000", opacity: 0.35, radius: 16, elevation: 18 }
    : { color: "#000", opacity: 0.18, radius: 12, elevation: 8 };

  // ⬇️ Frosted popup — iOS: GlassBG, Android: pre-blurred artwork + opaque tint
  const renderPopupCard = () => {
    const tintBg = isDark
      ? "rgba(28, 28, 30, 0.32)" // more solid (was 0.72)
      : "rgba(232, 232, 236, 0.07)"; // more solid (was 0.78)

    if (IS_ANDROID) {
      return (
        <View
          style={{
            flex: 1,
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
            backgroundColor: isDark
              ? "rgba(28, 28, 30, 0.98)"
              : "rgba(250, 250, 250, 0.99)",
          }}
        >
          {albumArtwork ? (
            <Image
              source={{ uri: albumArtwork }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              blurRadius={30}
              fadeDuration={0}
            />
          ) : null}

          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: tintBg }]}
            pointerEvents="none"
          />

          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ paddingVertical: 6 }}
          >
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => closeMenu(() => nav.navigate("Settings"))}
            >
              <Text style={[styles.menuText, { color: "#ffff" }]}>
                Settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => closeMenu(() => nav.navigate("Account"))}
            >
              <Text style={[styles.menuText, { color: "#ffff" }]}>Account</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      );
    }

    // iOS real blur
    return (
      <GlassBG
        radius={12}
        lightMode={!isDark}
        blurTarget={blurTargetRef}
        settings={{
          tintOpacity: isDark ? 0.55 : 0.7,
          frostBlur: 24,
          distortionStrength: 45,
        }}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ paddingVertical: 6 }}
        >
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => closeMenu(() => nav.navigate("Settings"))}
          >
            <Text style={[styles.menuText, { color: theme.text }]}>
              Settings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => closeMenu(() => nav.navigate("Account"))}
          >
            <Text style={[styles.menuText, { color: theme.text }]}>
              Account
            </Text>
          </TouchableOpacity>
        </Pressable>
      </GlassBG>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <BlurTargetView
        ref={blurTargetRef}
        style={StyleSheet.absoluteFill}
        collapsable={false}
      >
        {/* ── FROSTED HEADER ── */}
        <View style={[styles.headerWrapper, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerContent}>
            <GlassIconBtn
              colors={headerColors}
              icon={BACK_ICON}
              iconStyle={{ width: 16, height: 16 }}
              onPress={() => nav.goBack()}
            />

            <View style={styles.headerRight}>
              <GlassIconBtn
                colors={headerColors}
                icon={ShareSvg}
                iconStyle={{ width: 18, height: 18, tintColor: theme.text }}
                onPress={handleShareAlbum}
              />
              <GlassIconBtn
                colors={headerColors}
                icon={MORE_ICON}
                iconStyle={{
                  width: 18,
                  height: 18,
                  tintColor: theme.iconsColour,
                }}
                onPress={() => setMenuVisible(true)}
              />
            </View>
          </View>
        </View>

        {/* ── SONG LIST ── */}
        <Animated.FlatList
          data={albumSongs}
          keyExtractor={(it: any) => String(it.id)}
          renderItem={renderSong}
          style={{ opacity: showLoading ? 0 : 1 }}
          pointerEvents={showLoading ? "none" : "auto"}
          contentContainerStyle={{
            paddingBottom: 200,
            paddingTop: insets.top + HEADER_CONTENT_H + 20,
          }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: lineColor }]} />
          )}
          ListHeaderComponent={
            <View>
              <View style={styles.heroWrap}>
                <Image
                  source={
                    albumArtwork ? { uri: albumArtwork } : MUSIC_DEFAULT_PNG
                  }
                  style={styles.hero}
                  fadeDuration={0}
                />
                <Animated.View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      opacity: blurOpacity,
                      borderRadius: 8,
                      overflow: "hidden",
                    },
                  ]}
                  pointerEvents="none"
                >
                  <BlurView
                    intensity={50}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>

              <Text
                style={[styles.title, { color: textColor }]}
                numberOfLines={2}
              >
                {displayAlbumName}
              </Text>

              <Text
                style={[styles.artist, { color: textColor }]}
                numberOfLines={1}
              >
                {albumArtist}
              </Text>

              <View style={styles.metaRow}>
                <Text style={[styles.meta, { color: subTextColor }]}>
                  {albumGenre} · {albumYear}
                </Text>
                <Image
                  source={LOSSLESS_ICON}
                  style={[styles.losslessIcon, { tintColor: subTextColor }]}
                  resizeMode="contain"
                />
                <Text style={[styles.meta, { color: subTextColor }]}>
                  {" "}
                  Hi-Res Lossless
                </Text>
              </View>

              <View style={styles.controlsRow}>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: circleBg }]}
                  onPress={handleShuffle}
                  disabled={albumSongs.length === 0}
                >
                  <ShuffleIcon size={20} color={textColor} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.playBtn, { backgroundColor: textColor }]}
                  onPress={handlePlay}
                  disabled={albumSongs.length === 0}
                >
                  <PlayIcon size={22} color={"#000000"} />
                  <Text
                    style={[
                      styles.playText,
                      { color: "#000000", fontWeight: "700" },
                    ]}
                  >
                    Play
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: circleBg }]}
                  activeOpacity={0.7}
                  onPress={() => setMenuVisible(true)}
                >
                  <Text style={[styles.plusText, { color: textColor }]}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: lineColor }]} />
            </View>
          }
          ListFooterComponent={
            <View>
              <View style={[styles.divider, { backgroundColor: lineColor }]} />
              <View style={styles.footerMeta}>
                <Text style={[styles.footerDate, { color: subTextColor }]}>
                  {formattedDate}
                </Text>
                <Text style={[styles.footerCount, { color: subTextColor }]}>
                  {footerCountLine}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                No songs in this album
              </Text>
              <Text style={[styles.emptyText, { color: subTextColor }]}>
                Songs tagged with this album will appear here.
              </Text>
            </View>
          }
        />

        {/* ── INLINE POPUP — Android: solid frosted, iOS: real blur ── */}
        {menuVisible ? (
          <View
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => closeMenu()}
            />

            <Animated.View
              style={[
                styles.menuCard,
                {
                  top: insets.top + 54,
                  right: 10,
                  width: POPUP_WIDTH,
                  opacity: menuOpacity,
                  transform: [{ scale: menuScale }],
                  shadowColor: menuShadow.color,
                  shadowOpacity: menuShadow.opacity,
                  shadowRadius: menuShadow.radius,
                  elevation: menuShadow.elevation,
                },
              ]}
            >
              {renderPopupCard()}
            </Animated.View>
          </View>
        ) : null}
      </BlurTargetView>

      <ScreenLoader visible={showLoading} />

      {/* ── SONG OPTIONS MODAL ── */}
      <Modal
        visible={!!selectedSong}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          setSelectedSong(null);
          setAddToMode(false);
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => {
              setSelectedSong(null);
              setAddToMode(false);
            }}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surface,
                paddingBottom: insets.bottom + 12,
                borderTopColor: theme.border,
              },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.border }]}
            />

            <View style={styles.sheetHeader}>
              <Image
                source={
                  albumArtwork ? { uri: albumArtwork } : MUSIC_DEFAULT_PNG
                }
                style={styles.sheetArt}
                fadeDuration={0}
              />
              <View style={styles.sheetHeaderText}>
                <Text
                  style={[styles.sheetTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {selectedSong ? displayTitle(selectedSong) : "Song options"}
                </Text>
                <Text
                  style={[styles.sheetSub, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {selectedSong ? displayArtist(selectedSong) : UNKNOWN_ARTIST}
                </Text>
              </View>
            </View>

            <View
              style={[styles.sheetDivider, { backgroundColor: theme.border }]}
            />

            {!addToMode ? (
              <View>
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    const s = selectedSong;
                    setSelectedSong(null);
                    if (s) togglePin(s);
                  }}
                >
                  <View style={styles.optionRow}>
                    <PinSongIcon size={20} color={theme.iconsColour} />
                    <Text
                      style={[
                        styles.optionText,
                        { color: theme.text, marginLeft: 12 },
                      ]}
                    >
                      {selectedSong && pinnedIds[selectedSong.id]
                        ? "Unpin Song"
                        : "Pin Song"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.option} onPress={openAddTo}>
                  <View style={styles.optionRow}>
                    <Image
                      source={CREATE_PLAYLIST_ICON}
                      style={[
                        styles.optionIcon,
                        { tintColor: theme.iconsColour },
                      ]}
                      resizeMode="contain"
                      fadeDuration={0}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        { color: theme.text, marginLeft: 12 },
                      ]}
                    >
                      Add to playlist
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.option} onPress={playNext}>
                  <View style={styles.optionRow}>
                    <SkipNextIcon size={20} color={theme.iconsColour} />
                    <Text
                      style={[
                        styles.optionText,
                        { color: theme.text, marginLeft: 12 },
                      ]}
                    >
                      Play next
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text
                  style={[styles.subHeader, { color: theme.textSecondary }]}
                >
                  Choose a playlist
                </Text>

                <ScrollView style={{ maxHeight: 280 }}>
                  {playlists.length === 0 ? (
                    <Text
                      style={[
                        styles.noPlaylists,
                        { color: theme.textSecondary },
                      ]}
                    >
                      No playlists yet
                    </Text>
                  ) : (
                    playlists.map((pl) => (
                      <TouchableOpacity
                        key={pl.id}
                        style={styles.option}
                        onPress={() => addToPlaylist(pl)}
                      >
                        <Text
                          style={[styles.optionText, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {`♪ ${pl.name}`}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => setAddToMode(false)}
                >
                  <Text
                    style={[styles.optionText, { color: theme.textSecondary }]}
                  >
                    {"← Back"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.cancel, { borderTopColor: theme.border }]}
              onPress={() => {
                setSelectedSong(null);
                setAddToMode(false);
              }}
            >
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: HEADER_CONTENT_H,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: FONT,
    textAlign: "center",
    marginHorizontal: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  heroWrap: {
    alignSelf: "center",
    position: "relative",
    width: 220,
    height: 220,
    marginTop: 22,
    marginBottom: 18,
  },
  hero: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#1c1c1e",
    borderWidth: HAIRLINE,
    borderColor: "rgba(255, 255, 255, 0.26)", // subtle light hairline
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: FONT,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  artist: {
    fontSize: 18,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
    fontFamily: FONT,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  meta: {
    fontSize: 12.5,
    textAlign: "center",
    fontFamily: FONT,
  },
  losslessIcon: {
    width: 16,
    height: 16,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 18,
    marginBottom: 18,
  },
  circleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    minWidth: 160,
    paddingHorizontal: 28,
    borderRadius: 24,
    gap: 8,
  },
  playText: { fontSize: 16, fontWeight: "500", fontFamily: "Roboto-Bold" },
  plusText: {
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 30,
    fontFamily: FONT,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginBottom: 6,
  },

  songRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  starCol: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  star: { fontSize: 13 },
  count: {
    width: 34,
    minWidth: 34,
    textAlign: "right",
    paddingRight: 6,
    fontSize: 18,
    fontFamily: FONT,
    marginRight: 6,
    marginLeft: -35,
  },
  songInfo: { flex: 1, marginRight: 4, minWidth: 0 },
  songTitle: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: FONT,
    flexShrink: 1,
  },
  songArtist: {
    fontSize: 13,
    marginTop: 1,
    fontFamily: FONT,
    flexShrink: 1,
  },
  dotsHit: { paddingHorizontal: 10, paddingVertical: 4 },
  dots: { width: 17, height: 17 },
  sep: { height: 1, marginLeft: 42, marginRight: 16 },

  footerMeta: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  footerDate: { fontSize: 16, fontWeight: "500", fontFamily: FONT },
  footerCount: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 4,
    fontFamily: FONT,
  },
  empty: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", fontFamily: FONT },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
    fontFamily: FONT,
  },

  menuCard: {
    position: "absolute",
    borderRadius: 12,
    overflow: "hidden",
    // ⚠️ NO backgroundColor, NO width here — the inner card draws those.
    // Width is set inline via POPUP_WIDTH so it's easy to tweak.
  },
  menuRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuText: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: FONT,
  },

  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 4,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#1c1c1e",
  },
  sheetHeaderText: { flex: 1, marginLeft: 14, minWidth: 0 },
  sheetTitle: { fontSize: 15, fontWeight: "600", fontFamily: FONT },
  sheetSub: { fontSize: 12.5, marginTop: 4, fontFamily: FONT },
  sheetDivider: { height: StyleSheet.hairlineWidth, marginBottom: 4 },

  option: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionIcon: { width: 20, height: 20 },
  optionText: { fontSize: 16, fontFamily: FONT },

  subHeader: {
    fontSize: 12.5,
    fontFamily: FONT,
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 6,
  },
  noPlaylists: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
    fontFamily: FONT,
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelText: { fontSize: 16, fontFamily: FONT },
});