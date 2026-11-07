// src/components/MiniPlayer.tsx
//
// UNIFIED mini player for BOTH songs and videos.
//
// Entrance: the mini player slides up from BEHIND the tab bar the first
// time content appears, and again after content was cleared. While the
// entrance animation is running the overlay is clipped at the tab bar's
// top edge (overflow hidden), so nothing draws over the tab bar.
//
// FIX: the root's zIndex / elevation are now CONSTANT. Previously they were
// flipped 0 -> 999 when the entrance finished, which made Android re-order
// and redraw the navbar (icons / labels disappeared). The clipping alone
// already keeps the mini player from drawing over the navbar.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  ImageStyle,
  Modal,
  Pressable,
  Share,
  BackHandler,
  LayoutChangeEvent,
  StatusBar,
  Easing,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openAlbumDetails } from "../navigation/navigationService";
import { getColors } from "react-native-image-colors";
import { VideoView } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { usePlayerStore } from "../store/playerStore";
import { useMediaStore } from "../store/mediaStore";
import { useVideoStore } from "../store/videoStore";
import { useVideoBridge } from "../store/videoPlayerBridge";
import TrackPlayer from "@rntp/player";
import { useSettingsStore } from "../store/settingsStore";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useTheme } from "../hooks/useTheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScrollView } from "react-native";
import { readId3Tags, isUnknownArtist, SongTags } from "../utils/id3Tags";
import { showToast } from "../utils/toast";
import { waitForPlayerSetup } from "../services/audio/playerSetup"; 
import {
  getCachedTags,
  getCachedArtwork,
  hasCachedTags,
  readAndCacheTags,
} from "../services/audioTags/tagService";
import {
  playerExpansionProgress,
  playerExpansionShared,
} from "../navigation/playerAnimation";
import { PlayIcon, PauseIcon, ForwardIcon } from "../icons/Icons";
import { ExpandIcon } from "../icons/VideoIcons";
import { SleepTimerSheet, useSleepTimer, formatTimer } from "./SleepTimer";
import { ExpandedPreview, FullscreenPlayer } from "./Fullscreen";
import { SF, sfFont } from "./playerShared";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import * as ExpoBlur from "expo-blur";

const BlurView = ExpoBlur.BlurView;

const { width: WIN_W, height: WIN_H } = Dimensions.get("window");

// NOTE: the glass settings (blur, tint, shadow, ...) now live in the theme
// file (src/hooks/useTheme.ts → theme.glass), shared with the root navbar.
// Change the glass look there.
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Shared assets
// ---------------------------------------------------------------------------
const MUSIC_DEFAULT_PNG = require("../../assets/images/musicdefault.png");

const MUSIC_DEFAULT_SRC: string | null = (() => {
  try {
    const src = Image.resolveAssetSource(MUSIC_DEFAULT_PNG);
    return typeof src?.uri === "string" ? src.uri : null;
  } catch {
    return null;
  }
})();

// ──────────────────────────────────────────────────────────────────────────
// @rntp/player ships .ts source (not .d.ts), so `skipLibCheck` does NOT
// apply to it. `State` exists at runtime but is not re-exported from the
// package-root typings. Pull it off the raw module with an ordinal-matching
// fallback so `state === State.Playing` behaves the same at runtime.
// ──────────────────────────────────────────────────────────────────────────
const State: any =
  (require("@rntp/player") as any).State ?? {
    None: 0,
    Ready: 1,
    Buffering: 2,
    Playing: 3,
    Paused: 4,
    Stopped: 5,
    Ended: 6,
    Loading: 7,
    Error: 8,
  };

// ---------------------------------------------------------------------------
// Default song artwork
// ---------------------------------------------------------------------------
const DefaultSongArt = React.memo(function DefaultSongArt({
  size,
}: {
  size: number;
}) {
  const [failed, setFailed] = React.useState(false);
  const theme = useTheme() as any;

  const isDark = theme.mode === "dark";
  const bgColor = isDark ? "#1c1c1e" : "#bcbcc4";
  const textColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {!failed ? (
        <Image
          source={MUSIC_DEFAULT_PNG}
          style={{ width: size, height: size }}
          resizeMode="cover"
          fadeDuration={0}
          onError={(e) => {
            console.log("[DefaultSongArt] PNG failed to load:", e.nativeEvent);
            setFailed(true);
          }}
        />
      ) : (
        <Text
          style={{ color: textColor, fontSize: size * 0.5, fontWeight: "700" }}
        >
          ♪
        </Text>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Artwork helpers
// ---------------------------------------------------------------------------
const normalizeArtwork = (raw: any): string | null => {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (
    lower === "null" ||
    lower === "undefined" ||
    lower.endsWith("/null") ||
    lower.endsWith("/undefined") ||
    lower === "file://" ||
    lower === "file:///"
  ) {
    return null;
  }
  if (
    t.startsWith("http") ||
    t.startsWith("file://") ||
    t.startsWith("content://") ||
    t.startsWith("ph://") ||
    t.startsWith("data:")
  ) {
    return t;
  }
  return `file://${t}`;
};

// ---------------------------------------------------------------------------
// SmoothArt
// ---------------------------------------------------------------------------
const SmoothArt = React.memo(function SmoothArt({
  uri,
  size,
}: {
  uri: string | null;
  size: number;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [bad, setBad] = useState<Record<string, true>>({});
  const [slow, setSlow] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) setShown(null);
  }, [uri]);

  const markBad = useCallback((u: string) => {
    console.log("[SmoothArt] artwork failed, using default:", u);
    setBad((p) => (p[u] ? p : { ...p, [u]: true }));
  }, []);

  const uriOk = !!uri && !bad[uri];
  const baseUri = uriOk && shown && !bad[shown] ? shown : null;
  const loadingUri = uriOk && uri !== shown ? uri : null;

  useEffect(() => {
    if (!loadingUri) return;
    const t = setTimeout(() => setSlow(loadingUri), 1200);
    return () => clearTimeout(t);
  }, [loadingUri]);

  const showDefault = !baseUri && (!uriOk || slow === uri);

  const fill = {
    position: "absolute",
    left: 0,
    top: 0,
    width: size,
    height: size,
  } as const;

  return (
    <View style={{ width: size, height: size, overflow: "hidden" }}>
      {baseUri ? (
        <Image
          source={{ uri: baseUri }}
          style={fill}
          resizeMode="cover"
          fadeDuration={0}
          onError={() => markBad(baseUri)}
        />
      ) : showDefault ? (
        <DefaultSongArt size={size} />
      ) : (
        <View style={[fill, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
      )}

      {loadingUri ? (
        <Image
          key={loadingUri}
          source={{ uri: loadingUri }}
          style={fill}
          resizeMode="cover"
          fadeDuration={0}
          onLoad={() => setShown(loadingUri)}
          onError={() => {
            markBad(loadingUri);
            setShown(null);
          }}
        />
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------------------
// VideoArt
// ---------------------------------------------------------------------------
const VideoArt = React.memo(function VideoArt({
  thumb,
  width,
  height,
  expanded,
  showVideo,
  player,
}: {
  thumb: string | null;
  width: number;
  height: number;
  expanded: boolean;
  showVideo: boolean;
  player: any;
}) {
  const fit = expanded ? "contain" : "cover";
  return (
    <View
      style={{ width, height, backgroundColor: "#000", overflow: "hidden" }}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={{ width, height }}
          resizeMode={fit}
          fadeDuration={0}
        />
      ) : null}
      {showVideo && player ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          nativeControls={false}
          allowsPictureInPicture={false}
          surfaceType="textureView"
        />
      ) : null}
    </View>
  );
});

// ── Mini player design ──────────────────────────────────────────────────────
const NAVBAR_HEIGHT = 64; // was 56  → matches styles.barRow.height
const NAVBAR_BOTTOM_GAP = 12; // was 0   → matches styles.barRow.bottom

const MINI_GAP = 8; // was 0   → space between mini player and navbar
const MINI_SIDE_MARGIN = 16; // was 0   → same as navbar left/right
const MINI_HEIGHT = 46; // was 64  → smaller
const MINI_RADIUS = MINI_HEIGHT / 2; // 50% pill
const MINI_BORDER_WIDTH = 0.5;
const MINI_BORDER_COLOR_DARK = "rgba(218, 208, 208, 0.34)";
const MINI_BORDER_COLOR_LIGHT = "rgba(0, 0, 0, 0.14)";

const MINI_ART_SIZE = 36;
const MINI_VIDEO_W = 64; // 64 x 36 (16:9) fits the 46px pill
const VIDEO_ASPECT = 9 / 16;
const MINI_ART_LEFT = MINI_SIDE_MARGIN + 12;
const MINI_ART_RADIUS = 6;
const PLAYER_ART_RADIUS = 6;

const PLAYER_ART_MARGIN = 30;
const PLAYER_ART_TOP = 120;
const PLAYER_ART_GAP = 28;

const AUTO_FULLSCREEN_DELAY_MS = 1000;

const CAPTURE_DY = 8;
const SNAP_VELOCITY = 0.5;

const FALLBACK_BG = "#141416";

const PULSE_PLAYING = 1.05;
const PULSE_PAUSED = 0.9;

const STORAGE_PLAYLISTS = "@library_playlists";

const MINI_DIVIDER_THICKNESS = 0; // was 1
const MINI_ART_BORDER = 0.5;

const MINI_SHADOW_HEIGHT = 14;
const MINI_SHADOW_DARK_ALPHA = 0; // was 0.5
const MINI_SHADOW_LIGHT_ALPHA = 0; // was 0.2

const MINI_PLAY_ICON_SIZE = 24;
const MINI_PAUSE_ICON_SIZE = 28;
const MINI_FORWARD_ICON_SIZE = 32;

const getGeometry = (screenW: number, screenH: number, insetBottom: number) => {
  const playerArt = screenW - PLAYER_ART_MARGIN * 2;
  const bottomOffset =
    insetBottom + NAVBAR_BOTTOM_GAP + NAVBAR_HEIGHT + MINI_GAP;
  const miniTop = screenH - bottomOffset - MINI_HEIGHT;
  const miniArtTop = miniTop + (MINI_HEIGHT - MINI_ART_SIZE) / 2;
  const fullArtTop = PLAYER_ART_TOP;
  return {
    playerArt,
    bottomOffset,
    miniTop,
    miniArtTop,
    fullArtTop,
    miniArtScale: MINI_ART_SIZE / playerArt,
    blockTop: PLAYER_ART_TOP + playerArt + PLAYER_ART_GAP,
  };
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length === 4)
    h = h
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};
const rgbToHex = (r: number, g: number, b: number): string => {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
};

const mixHex = (a: string, b: string, t: number): string => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return b;
  return rgbToHex(
    A.r + (B.r - A.r) * t,
    A.g + (B.g - A.g) * t,
    A.b + (B.b - A.b) * t,
  );
};

const darkenHex = (hex: string, factor = 0.55): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return FALLBACK_BG;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
};

const pickBackgroundColor = (result: any): string => {
  if (!result) return FALLBACK_BG;

  const candidates: (string | undefined)[] =
    result.platform === "ios"
      ? [result.primary, result.background, result.secondary, result.detail]
      : [
          result.dominant,
          result.average,
          result.darkVibrant,
          result.muted,
          result.darkMuted,
          result.vibrant,
          result.lightVibrant,
          result.lightMuted,
        ];

  const valid = candidates.filter(
    (c): c is string => typeof c === "string" && !!hexToRgb(c),
  );

  if (valid.length === 0) return FALLBACK_BG;

  const picked = valid[0];
  const rgb = hexToRgb(picked)!;
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;

  if (brightness > 210) return darkenHex(picked, 0.45);
  if (brightness > 170) return darkenHex(picked, 0.6);
  if (brightness > 120) return darkenHex(picked, 0.75);
  return darkenHex(picked, 0.9);
};

const colorCache = new Map<string, string>();

const useArtworkColor = (
  uri: string | null,
  fallbackUri: string | null = null,
) => {
  const [, force] = useState(0);
  const lastRef = useRef<string>(FALLBACK_BG);

  const effectiveUri = uri ?? fallbackUri ?? null;

  useEffect(() => {
    if (!effectiveUri || colorCache.has(effectiveUri)) return;
    let cancelled = false;
    getColors(effectiveUri, {
      fallback: FALLBACK_BG,
      cache: true,
      key: effectiveUri,
    })
      .then((r: any) => {
        colorCache.set(effectiveUri, pickBackgroundColor(r));
      })
      .catch(() => {
        colorCache.set(effectiveUri, FALLBACK_BG);
      })
      .finally(() => {
        if (colorCache.size > 150) {
          colorCache.delete(colorCache.keys().next().value as string);
        }
        if (!cancelled) force((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveUri]);

  if (!effectiveUri) return FALLBACK_BG;
  const cached = colorCache.get(effectiveUri);
  if (cached) {
    lastRef.current = cached;
    return cached;
  }
  return lastRef.current;
};

// ---------------------------------------------------------------------------
// ColorFade
// ---------------------------------------------------------------------------
const ColorFade = React.memo(function ColorFade({
  color,
  opacity,
  duration = 600,
}: {
  color: string;
  opacity: Animated.AnimatedInterpolation<number> | number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(color);
  const currentRef = useRef(color);

  useEffect(() => {
    const from = currentRef.current;
    if (from === color) return;

    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const c = t >= 1 ? color : mixHex(from, color, eased);
      currentRef.current = c;
      setDisplay(c);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [color, duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: display, opacity }]}
    />
  );
});

// ---------------------------------------------------------------------------
// Song meta
// ---------------------------------------------------------------------------
const UNKNOWN_ALBUM = "Unknown album";

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

const useSongMeta = (song: any) => {
  const [, force] = useState(0);
  const id = song?.id;

  useEffect(() => {
    if (!song || hasCachedTags(song.id)) return;
    const uri = song.uri ?? song.path;
    if (!uri) return;
    let cancelled = false;
    readAndCacheTags(song.id, uri)
      .then(() => {
        if (!cancelled) force((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!song)
    return { title: "Unknown Title", artist: "Unknown Artist", album: "" };

  const tags: any = getCachedTags(song.id) ?? {};
  const tagTitle = typeof tags.title === "string" ? tags.title.trim() : "";
  const tagArtist = typeof tags.artist === "string" ? tags.artist.trim() : "";
  const tagAlbum = typeof tags.album === "string" ? tags.album.trim() : "";

  const title = tagTitle || song.title || "Unknown Title";
  const artist = !isUnknownArtist(tagArtist)
    ? tagArtist
    : !isUnknownArtist(song.artist)
      ? (song.artist as string)
      : "Unknown Artist";
  const album = tagAlbum || (typeof song.album === "string" ? song.album : "");

  return { title, artist, album };
};

// ===========================================================================
// MINI PLAYER
// ===========================================================================
type MiniPlayerProps = {
  blurTargetRef?: React.RefObject<any>;
};
export default function MiniPlayer({ blurTargetRef }: MiniPlayerProps = {}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Android blur needs the same blur target the navbar uses.
  useEffect(() => {
    if (Platform.OS === "android" && !blurTargetRef) {
      console.warn(
        "[MiniPlayer] blurTargetRef is missing, so the glass blur is off on Android. " +
          "In RootNavigator use: <MiniPlayer blurTargetRef={blurTargetRef} />",
      );
    }
  }, [blurTargetRef]);

  const dynamicBg = useSettingsStore((s) => s.dynamicBg);

  const [box, setBox] = useState({ w: WIN_W, h: WIN_H });
  const SCREEN_W = box.w;
  const SCREEN_H = box.h;
  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setBox((prev) =>
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height },
    );
  }, []);

  const isDark = theme.mode === "dark";
  const miniText = theme.text;

  const glass = theme.glass;
  const glassFrost = clamp(glass.frostBlur, 0, 30);
  const glassGray = Math.round(clamp(glass.tintColor, 0, 255));
  const glassTintOpacity = clamp(glass.tintOpacity, 0, 1);
  const glassShadowSpread = clamp(glass.shadowSpread, -55, 55);
  const glassShadowBlur = clamp(glass.shadowBlur, 0, 50);
  const glassBlurIntensity = (glassFrost / 30) * 100;
  const glassTint = `rgba(${glassGray},${glassGray},${glassGray},${glassTintOpacity})`;
  const glassShadowColor = isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.18)";
  const miniBorderBase = isDark
    ? MINI_BORDER_COLOR_DARK
    : MINI_BORDER_COLOR_LIGHT;

  // ── SONG source ───────────────────────────────────────────────────────────
  const liveSong = usePlayerStore((state) => state.currentTrack);
  const [heldSong, setHeldSong] = useState(liveSong);

  useEffect(() => {
    if (liveSong) {
      setHeldSong(liveSong);
      return;
    }
    const ps: any = usePlayerStore.getState();
    const isEmpty = !ps.queue || ps.queue.length === 0;
    const delay = isEmpty ? 0 : 500;

    const t = setTimeout(() => setHeldSong(null), delay);
    return () => clearTimeout(t);
  }, [liveSong]);

  const song = liveSong ?? heldSong;
  // ── RESTORE NATIVE PLAYER AFTER APP REFRESH ─────────────────────────────
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 1000;

    const isNotReadyError = (err: any): boolean => {
      const m = String(err?.message ?? err).toLowerCase();
      return (
        m.includes("unavailable") ||
        m.includes("not initialized") ||
        m.includes("not ready")
      );
    };

    const syncPlayerState = async () => {
      if (!isMounted || hasSyncedRef.current) return;

      const existingSong = usePlayerStore.getState().currentTrack;
      if (existingSong) {
        hasSyncedRef.current = true;
        return;
      }

      try {
        await waitForPlayerSetup();
        if (!isMounted) return;

        const TP: any = TrackPlayer as any;

        // v5 has getActiveMediaItem; old builds had getActiveTrack.
        let activeTrack: any = null;
        if (typeof TP.getActiveMediaItem === "function") {
          activeTrack = await TP.getActiveMediaItem();
        } else if (typeof TP.getActiveTrack === "function") {
          activeTrack = await TP.getActiveTrack();
        }

        if (!isMounted) return;

        // No active track in native player — nothing to restore. STOP.
        // (No retry: nothing was ever playing.)
        if (!activeTrack) {
          hasSyncedRef.current = true;
          return;
        }

        const id =
          activeTrack.mediaId ?? activeTrack.id ?? activeTrack.trackId;

        const currentSong = {
          id: String(id),
          title: activeTrack.title || "Unknown Title",
          artist: activeTrack.artist || "Unknown Artist",
          album: activeTrack.albumTitle || activeTrack.album || "Unknown Album",
          artwork: activeTrack.artworkUrl ?? activeTrack.artwork,
          uri: activeTrack.url,
          duration: activeTrack.duration || 0,
          albumArt: activeTrack.artworkUrl ?? activeTrack.artwork ?? null,
          fileName: "",
          fileSize: 0,
          dateAdded: Date.now(),
          dateModified: Date.now(),
          isFavorite: false,
        };

        let queue: any[] = [];
        try {
          let nativeQueue: any = [];
          if (typeof TP.getQueue === "function") {
            nativeQueue = await TP.getQueue();
          }
          queue = Array.isArray(nativeQueue)
            ? nativeQueue.map((t: any) => {
                const qid = t.mediaId ?? t.id ?? t.trackId;
                return {
                  id: String(qid),
                  title: t.title || "Unknown Title",
                  artist: t.artist || "Unknown Artist",
                  album:
                    t.albumTitle || t.album || "Unknown Album",
                  artwork: t.artworkUrl ?? t.artwork,
                  uri: t.url,
                  duration: t.duration || 0,
                  albumArt:
                    t.artworkUrl ?? t.artwork ?? null,
                  fileName: "",
                  fileSize: 0,
                  dateAdded: Date.now(),
                  dateModified: Date.now(),
                  isFavorite: false,
                };
              })
            : [];
        } catch (e) {
          console.log("[MiniPlayer] Queue restore failed:", e);
        }

        if (!queue.some((s) => s.id === currentSong.id)) {
          queue.unshift(currentSong);
        }
        const index = queue.findIndex((s) => s.id === currentSong.id);

        usePlayerStore.getState().setQueue(queue, index >= 0 ? index : 0);

        let playing = false;
        try {
          if (typeof TP.isPlaying === "function") {
            playing = !!TP.isPlaying();
          } else if (typeof TP.getState === "function") {
            const st = await TP.getState();
            playing = st === State.Playing;
          }
        } catch {}
        usePlayerStore.getState().setPlaying(playing);

        setHeldSong(currentSong);
        hasSyncedRef.current = true;
        console.log("[MiniPlayer] Native player restored:", currentSong.title);
      } catch (error: any) {
        if (!isMounted) return;
        // Log once; only retry if the error looks like "not ready yet".
        if (isNotReadyError(error) && attempts < MAX_RETRIES) {
          attempts++;
          retryTimer = setTimeout(syncPlayerState, RETRY_DELAY);
        } else {
          console.log("[MiniPlayer] Restore skipped:", error?.message ?? error);
          hasSyncedRef.current = true;
        }
      }
    };

    syncPlayerState();

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);
  // ───────────────────────────────────────────────────────────────────────

  // ── VIDEO source ──────────────────────────────────────────────────────────
  const videoCurrent: any = useVideoStore((s) => s.current);
  const videoExpanded = useVideoStore((s) => s.expanded);
  const videoPlayToken = useVideoStore((s) => s.playToken);
  const videoFavs: any = useVideoStore((s) => s.favourites);
  const toggleVideoFav = useVideoStore((s) => s.toggleFav);
  const nextVideo = useVideoStore((s) => s.next);
  const prevVideo = useVideoStore((s) => s.prev);
  const videoQueue: any[] = useVideoStore((s) => s.queue) as any;
  const videoPinned = useVideoStore((s: any) => !!s.pinned?.[videoCurrent?.id]);
  const togglePin = useVideoStore((s: any) => s.togglePin);
  const playNextFavourite = useVideoStore((s: any) => s.playNextFavourite);

  const videoPlayer = useVideoBridge((s) => s.player);
  const videoPlaying = useVideoBridge((s) => s.isPlaying);

  const isVideo = !!videoCurrent;
  const isVideoRef = useRef(isVideo);
  isVideoRef.current = isVideo;

  const videoIdx = (videoQueue || []).findIndex(
    (v: any) => v?.id === videoCurrent?.id,
  );
  const hasNextVideo =
    videoIdx !== -1 && videoIdx < (videoQueue?.length ?? 0) - 1;

  const meta = useSongMeta(isVideo ? null : song);

  const favorites = useMediaStore((s) => s.favoritesSong);
  const toggleFav = useMediaStore((s) => s.toggleSongFavorite);
  const musicPlaying = usePlayerStore((state) => state.isPlaying);

  const hasNextSong = usePlayerStore((state) => {
    const len = state.queue.length;
    const idx = state.currentIndex;
    if (idx < 0 || len === 0) return false;
    const rep = String(state.repeat);
    if (rep !== "off" && rep !== "one") return true;
    if (state.shuffle && len > 1) return true;
    return idx < len - 1;
  });
  const canGoNext = isVideo ? hasNextVideo : hasNextSong;
  const hasNextVideoRef = useRef(hasNextVideo);
  hasNextVideoRef.current = hasNextVideo;
  const hasNextSongRef = useRef(hasNextSong);
  hasNextSongRef.current = hasNextSong;
  const isPlaying = isVideo ? videoPlaying : musicPlaying;
  const { playPause, next, prev, seek } = useAudioPlayer();

  const displayTitle = isVideo ? (videoCurrent.title ?? "") : meta.title;
  const displayArtist = isVideo ? (videoCurrent.artist ?? "") : meta.artist;
  const miniTitle = isVideo
    ? videoCurrent.title || "Unknown Title"
    : (song as any)?.title || "Unknown Title";
  const itemKey: string | number = isVideo
    ? `v:${videoCurrent.id}`
    : ((song as any)?.id ?? "none");

  const artworkUri = isVideo
    ? normalizeArtwork(videoCurrent.thumbnail)
    : normalizeArtwork(
        (song as any)?.artwork ??
          (song as any)?.albumArt ??
          (song ? getCachedArtwork((song as any).id) : null) ??
          null,
      );

  const [showOptions, setShowOptions] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [addToOpen, setAddToOpen] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsAnimated, setFsAnimated] = useState(true);
  const sleep = useSleepTimer(() => {
    if (usePlayerStore.getState().isPlaying) {
      void playPause();
    }
  });

  const tagCache = useRef<Record<string, SongTags>>({});
  const [fileTags, setFileTags] = useState<SongTags | null>(null);

  useEffect(() => {
    if (!showOptions || !song || isVideo) return;

    const id = String(song.id);
    const cached = tagCache.current[id];
    if (cached) {
      setFileTags(cached);
      return;
    }

    let cancelled = false;
    setFileTags(null);

    const uri = (song as any).uri ?? (song as any).path;
    if (!uri) {
      tagCache.current[id] = {};
      setFileTags({});
      return;
    }

    readId3Tags(uri)
      .then((t) => {
        tagCache.current[id] = t;
        if (!cancelled) setFileTags(t);
      })
      .catch(() => {
        tagCache.current[id] = {};
        if (!cancelled) setFileTags({});
      });

    return () => {
      cancelled = true;
    };
  }, [showOptions, song?.id, isVideo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFileTags(null);
  }, [song?.id]);

  useEffect(() => {
    if (artworkUri) {
      Image.prefetch(artworkUri as string).catch(() => {});
    }
  }, [artworkUri]);

  const currentIndexForArt = usePlayerStore((st) => st.currentIndex);
  useEffect(() => {
    if (isVideoRef.current) return;
    const q = usePlayerStore.getState().queue;
    for (const i of [
      currentIndexForArt - 1,
      currentIndexForArt + 1,
      currentIndexForArt + 2,
    ]) {
      const sg: any = q[i];
      if (!sg) continue;
      const u = normalizeArtwork(
        sg.artwork ?? sg.albumArt ?? getCachedArtwork(sg.id) ?? null,
      );
      if (u) Image.prefetch(u).catch(() => {});
    }
  }, [currentIndexForArt]);

  const progress = playerExpansionProgress;

  const artworkScale = useRef(new Animated.Value(1)).current;

  const handlePlayPause = useCallback(() => {
    if (isVideoRef.current) useVideoBridge.getState().togglePlay();
    else void playPause();
  }, [playPause]);

  const handleNext = useCallback(() => {
    if (isVideoRef.current) {
      if (!hasNextVideoRef.current) return;
      nextVideo();
    } else {
      if (!hasNextSongRef.current) return;
      void next();
    }
  }, [next, nextVideo]);

  const handlePrev = useCallback(() => {
    if (isVideoRef.current) prevVideo();
    else void prev();
  }, [prev, prevVideo]);

  const handleSeek = useCallback(
    (sec: number) => {
      if (isVideoRef.current) useVideoBridge.getState().seekTo(sec);
      else seek(sec);
    },
    [seek],
  );

  const pulseFirst = useRef(true);
  useEffect(() => {
    if (pulseFirst.current) {
      pulseFirst.current = false;
      return;
    }
    const t = setTimeout(() => {
      Animated.spring(artworkScale, {
        toValue: isPlaying ? PULSE_PLAYING : PULSE_PAUSED,
        friction: 5,
        useNativeDriver: false,
      }).start();
    }, 150);
    return () => clearTimeout(t);
  }, [isPlaying, artworkScale]);

  const valueRef = useRef<number>((progress as any)._value ?? 0);
  const [isOpen, setIsOpen] = useState(valueRef.current > 0.6);
  const isOpenRef = useRef(valueRef.current > 0.6);

  const [sheetShown, setSheetShown] = useState(valueRef.current > 0.02);
  const sheetShownRef = useRef(valueRef.current > 0.02);

  useEffect(() => {
    let lastPush = 0;
    const id = progress.addListener(({ value }) => {
      valueRef.current = value;

      // Throttle writes to the Reanimated shared value (≈60fps max)
      const now = Date.now();
      if (now - lastPush >= 16) {
        lastPush = now;
        playerExpansionShared.value = value;
      }

      const open = value > 0.6;
      if (open !== isOpenRef.current) {
        isOpenRef.current = open;
        setIsOpen(open);
      }
      const shown = value > 0.02;
      if (shown !== sheetShownRef.current) {
        sheetShownRef.current = shown;
        setSheetShown(shown);
      }
    });

    return () => {
      progress.removeListener(id);
    };
  }, [progress]);

  const geo = getGeometry(SCREEN_W, SCREEN_H, insets.bottom);

  // ═══════════════════════════════════════════════════════════════════════
  // ENTRANCE ANIMATION — slides up from BEHIND the tab bar
  // ═══════════════════════════════════════════════════════════════════════
  const enterAnim = useRef(new Animated.Value(0)).current;
  const hasBeenVisibleRef = useRef(false);
  const hasContent = !!(song || isVideo);
  const [entranceActive, setEntranceActive] = useState(false);

  useEffect(() => {
    if (hasContent && !hasBeenVisibleRef.current) {
      hasBeenVisibleRef.current = true;
      setEntranceActive(true); // turn clipping ON
      enterAnim.setValue(0);
      Animated.timing(enterAnim, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setEntranceActive(false)); // turn clipping OFF
    } else if (!hasContent) {
      hasBeenVisibleRef.current = false;
      setEntranceActive(false);
      enterAnim.setValue(0);
    }
  }, [hasContent, enterAnim]);

  // MINI_HEIGHT + MINI_SHADOW_HEIGHT = fully hidden below the tab bar top
  const enterTranslateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [MINI_HEIGHT + MINI_SHADOW_HEIGHT, 0],
  });
  // ═══════════════════════════════════════════════════════════════════════

  const dragRangeRef = useRef(1);
  dragRangeRef.current = Math.max(1, geo.miniTop);

  const artColorRaw = useArtworkColor(
    artworkUri,
    isVideo ? null : MUSIC_DEFAULT_SRC,
  );
  const artColor = dynamicBg ? artColorRaw : FALLBACK_BG;

  const expandedOnDark = true;

  const settlingTo = useRef<0 | 1 | null>(null);
  const draggingRef = useRef(false);

  const settle = useCallback(
    (target: 0 | 1, velocityPxPerMs = 0) => {
      settlingTo.current = target;
      progress.stopAnimation();
      const velocity = (-velocityPxPerMs * 1000) / dragRangeRef.current;
      Animated.spring(progress, {
        toValue: target,
        velocity: Number.isFinite(velocity) ? velocity : 0,
        friction: 11,
        tension: 90,
        overshootClamping: true,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && settlingTo.current === target) {
          settlingTo.current = null;
        }
      });

      if (
        isVideoRef.current &&
        useVideoStore.getState().expanded !== (target === 1)
      ) {
        useVideoStore.getState().setExpanded(target === 1);
      }
    },
    [progress],
  );

  const expand = useCallback(() => settle(1), [settle]);

  const enterFullscreen = useCallback(() => {
    setFullscreen(true);
    ScreenOrientation.unlockAsync().catch(() => {});
  }, []);

  const exitFullscreen = useCallback(() => {
    setFsAnimated(true);
    setFullscreen(false);
    requestAnimationFrame(() => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => {});
    });
  }, []);

  const closeFullscreenToMini = useCallback(() => {
    settle(0);
    void exitFullscreen();
  }, [settle, exitFullscreen]);
  void closeFullscreenToMini;

  const autoFsPendingRef = useRef(false);
  const autoFsSessionRef = useRef(false);
  const instantExpandRef = useRef(false);
  const [autoFsNonce, setAutoFsNonce] = useState(0);
  const restartRef = useRef(false);
  const fullscreenRef = useRef(false);
  fullscreenRef.current = fullscreen;

  useEffect(() => {
    autoFsSessionRef.current = false;
    autoFsPendingRef.current = false;
  }, [videoPlayToken]);

  useEffect(() => {
    if (!isVideo) {
      autoFsSessionRef.current = false;
      autoFsPendingRef.current = false;
      return;
    }

    if (autoFsSessionRef.current) return;

    autoFsSessionRef.current = true;
    autoFsPendingRef.current = true;

    const bridge = useVideoBridge.getState();

    if (restartRef.current) {
      restartRef.current = false;
      try {
        bridge.seekTo(0);
      } catch {}
    }

    bridge.player?.play?.();

    const timer = setTimeout(() => {
      autoFsPendingRef.current = false;

      const currentBridge = useVideoBridge.getState();
      if (!currentBridge.isPlaying) {
        currentBridge.player?.play?.();
      }

      instantExpandRef.current = true;
      setFsAnimated(false);
      enterFullscreen();
    }, AUTO_FULLSCREEN_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isVideo, videoPlayToken, autoFsNonce, enterFullscreen]);

  const handleFsShow = useCallback(() => {
    if (!instantExpandRef.current) return;
    instantExpandRef.current = false;
    progress.stopAnimation();
    progress.setValue(1);
    settlingTo.current = null;
    if (isVideoRef.current && !useVideoStore.getState().expanded) {
      useVideoStore.getState().setExpanded(true);
    }
  }, [progress]);

  useEffect(() => {
    if (!isVideo || draggingRef.current) return;
    if (autoFsPendingRef.current) return;

    const target: 0 | 1 = videoExpanded ? 1 : 0;

    if (settlingTo.current === target) return;

    if (target === 1 && !fullscreenRef.current) {
      autoFsPendingRef.current = true;
      autoFsSessionRef.current = false;
      restartRef.current = true;

      setAutoFsNonce((n) => n + 1);
      return;
    }

    const current: 0 | 1 = valueRef.current > 0.5 ? 1 : 0;

    if (current === target) return;

    settle(target);
  }, [videoExpanded, isVideo, settle]);

  const wasVideoRef = useRef(false);
  useEffect(() => {
    if (wasVideoRef.current && !isVideo) {
      settle(0);
      if (fullscreen) {
        setFullscreen(false);
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {});
      }
    }
    wasVideoRef.current = isVideo;
  }, [isVideo, settle, fullscreen]);

  const [videoLayerReady, setVideoLayerReady] = useState(false);
  useEffect(() => {
    setVideoLayerReady(false);
    if (!isVideo) return;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setVideoLayerReady(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [isVideo, videoCurrent?.url]);

  const openAlbum = useCallback(() => {
    if (!song || isVideoRef.current) return;
    const albumName = cleanName(meta.album, UNKNOWN_ALBUM);
    const target = albumName.toLowerCase();
    const isUnknown = target === UNKNOWN_ALBUM.toLowerCase();

    const ids: any[] = isUnknown
      ? [(song as any).id] // unknown album: only this song
      : useMediaStore
          .getState()
          .songs.filter((s: any) => {
            const raw =
              getCachedTags(s.id)?.album ??
              (typeof s.album === "string" ? s.album : undefined);
            return cleanName(raw, UNKNOWN_ALBUM).toLowerCase() === target;
          })
          .map((s: any) => s.id);
    if (!ids.includes((song as any).id)) ids.push((song as any).id);

    const opened = openAlbumDetails({ albumName, songIds: ids });
    if (!opened) {
      showToast("Album page not available");
      return;
    }
    settle(0);
  }, [song, meta.album, settle]);

  useEffect(() => {
    if (!sheetShown) return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      settle(0);
      return true;
    });

    return () => sub.remove();
  }, [sheetShown, settle]);

  const startValRef = useRef(0);
  const startDyRef = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => {
        return (
          Math.abs(g.dy) > CAPTURE_DY && Math.abs(g.dy) > Math.abs(g.dx) * 1.2
        );
      },
      onMoveShouldSetPanResponder: (_, g) => {
        return (
          Math.abs(g.dy) > CAPTURE_DY && Math.abs(g.dy) > Math.abs(g.dx) * 1.2
        );
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_, g) => {
        draggingRef.current = true;
        startValRef.current = valueRef.current;
        startDyRef.current = g.dy;
        progress.stopAnimation((currentValue) => {
          startValRef.current = currentValue;
          valueRef.current = currentValue;
        });
      },
      onPanResponderMove: (_, g) => {
        const deltaY = g.dy - startDyRef.current;
        const nextProgress =
          startValRef.current - deltaY / dragRangeRef.current;
        const clamped = Math.max(0, Math.min(1, nextProgress));
        valueRef.current = clamped;
        progress.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        draggingRef.current = false;
        const deltaY = g.dy - startDyRef.current;
        const finalProgress = Math.max(
          0,
          Math.min(1, startValRef.current - deltaY / dragRangeRef.current),
        );

        let target: 0 | 1;
        if (g.vy < -SNAP_VELOCITY) {
          target = 1;
        } else if (g.vy > SNAP_VELOCITY) {
          target = 0;
        } else {
          target = finalProgress > 0.5 ? 1 : 0;
        }

        settle(target, g.vy);
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        settle(valueRef.current > 0.5 ? 1 : 0);
      },
    }),
  ).current;

  const handleShare = useCallback(async () => {
    if (!song) return;
    setShowOptions(false);
    try {
      await Share.share({
        title: song.title,
        message: `🎵 ${song.title}\nBy ${song.artist || "Unknown Artist"}`,
      });
    } catch (e) {
      console.log("[MiniPlayer] share error:", e);
    }
  }, [song]);

  const comingSoon = useCallback((label: string) => {
    setShowOptions(false);
    showToast(`${label} feature soon...`);
  }, []);

  const openSleepTimer = useCallback(() => {
    setShowOptions(false);
    setTimeout(() => setShowSleep(true), 350);
  }, []);

  const loadPlaylists = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      setPlaylists(raw ? JSON.parse(raw) : []);
    } catch (e) {
      console.log("[MiniPlayer] load playlists error:", e);
      setPlaylists([]);
    }
  }, []);

  const openAddToPlaylist = useCallback(async () => {
    setShowOptions(false);
    await loadPlaylists();
    setTimeout(() => setAddToOpen(true), 250);
  }, [loadPlaylists]);

  const addCurrentSongToPlaylist = useCallback(
    async (target: any) => {
      if (!song) return;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
        const all: any[] = raw ? JSON.parse(raw) : [];

        const already = (target.songs ?? []).some(
          (s: any) => s.id === (song as any).id,
        );
        if (already) {
          showToast(`Already in "${target.name}"`);
          setAddToOpen(false);
          return;
        }

        const updated = all.map((p) => {
          if (p.id !== target.id) return p;
          return {
            ...p,
            songs: [...(p.songs ?? []), song],
            updatedAt: Date.now(),
            artwork:
              p.artwork ??
              (song as any).artwork ??
              (song as any).albumArt ??
              null,
          };
        });

        await AsyncStorage.setItem(STORAGE_PLAYLISTS, JSON.stringify(updated));

        showToast(`Added to "${target.name}"`);
        setAddToOpen(false);
      } catch (e) {
        console.log("[MiniPlayer] add to playlist error:", e);
        showToast("Could not add to playlist");
      }
    },
    [song],
  );

  if (!song && !isVideo) return null;

  const isFav = isVideo
    ? !!videoFavs?.[videoCurrent.id]
    : !!favorites[(song as any).id];

  const onToggleFavAny = () => {
    if (isVideo) toggleVideoFav(videoCurrent.id);
    else toggleFav((song as any).id);
  };

  const sheetTitle = isVideo
    ? videoCurrent.title || "Unknown Title"
    : fileTags?.title || (song as any).title || "Unknown Title";
  const sheetArtist = isVideo
    ? videoCurrent.artist || ""
    : !isUnknownArtist(fileTags?.artist)
      ? (fileTags?.artist as string)
      : !isUnknownArtist((song as any).artist)
        ? ((song as any).artist as string)
        : "Unknown Artist";
  const sheetMovie = isVideo
    ? ""
    : fileTags?.album || (song as any).album || "Unknown Movie";

  const bgTop = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [geo.miniTop, 0],
    extrapolate: "clamp",
  });

  // Bottom edge immediately extends to 0 (the very bottom of the screen)
  // as soon as expansion starts, so there is no gap at the bottom.
  const bgBottom = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [geo.bottomOffset, 0, 0],
    extrapolate: "clamp",
  });

  const bgSide = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [MINI_SIDE_MARGIN, 0, 0],
    extrapolate: "clamp",
  });
  const bgRadius = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [MINI_RADIUS, 0],
    extrapolate: "clamp",
  });
  // inner clipped layer sits inside the border, so its radius is 1px smaller
  const innerRadius = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(0, MINI_RADIUS - MINI_BORDER_WIDTH), 0],
    extrapolate: "clamp",
  });
  // border disappears when the player expands to full screen
  const miniBorderWidth = progress.interpolate({
    inputRange: [0, 0.05],
    outputRange: [MINI_BORDER_WIDTH, 0],
    extrapolate: "clamp",
  });
  const miniBorderColor = progress.interpolate({
    inputRange: [0, 0.05],
    outputRange: [miniBorderBase, "rgba(234, 226, 226, 0)"],
    extrapolate: "clamp",
  });
  // offsets include the border so the content stays centred in the pill
  const frameLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-MINI_SIDE_MARGIN - MINI_BORDER_WIDTH, 0],
    extrapolate: "clamp",
  });
  const frameTop = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-geo.miniTop - MINI_BORDER_WIDTH, 0],
    extrapolate: "clamp",
  });
  const colorOpacity = progress.interpolate({
    inputRange: [0, 0.1, 0.6, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: "clamp",
  });
  const dividerOpacity = progress.interpolate({
    inputRange: [0, 0.05],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const shadowTop = Animated.add(bgTop, -MINI_SHADOW_HEIGHT);
  const shadowAlpha = isDark ? MINI_SHADOW_DARK_ALPHA : MINI_SHADOW_LIGHT_ALPHA;

  const miniContentY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -56],
    extrapolate: "clamp",
  });
  const miniContentOpacity = progress.interpolate({
    inputRange: [0, 0.04],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // NEW: fade the mini pill's background / glass tint / border with the same curve
  const miniBgOpacity = progress.interpolate({
    inputRange: [0, 0.04],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const blockY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [SCREEN_H - geo.blockTop, SCREEN_H - geo.blockTop, 0],
    extrapolate: "clamp",
  });

  const blockOpacity = progress.interpolate({
    inputRange: [0.5, 0.8],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const artFixedSize = geo.playerArt;
  const artH = isVideo
    ? Math.round(geo.playerArt * VIDEO_ASPECT)
    : geo.playerArt;
  const miniArtW = isVideo ? MINI_VIDEO_W : MINI_ART_SIZE;
  const miniArtScaleValue = miniArtW / geo.playerArt;
  const artOffsetX = MINI_ART_LEFT + miniArtW / 2 - geo.playerArt / 2;
  const artOffsetY = geo.miniTop + MINI_HEIGHT / 2 - artH / 2;
  const artExpandedTop = PLAYER_ART_TOP + (geo.playerArt - artH) / 2;

  const artLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [artOffsetX, PLAYER_ART_MARGIN],
    extrapolate: "clamp",
  });
  const artTop = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [artOffsetY, artExpandedTop],
    extrapolate: "clamp",
  });

  const artBaseScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [miniArtScaleValue, 1],
    extrapolate: "clamp",
  });

  const oneMinusProgress = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const pulseScale = Animated.add(
    oneMinusProgress,
    Animated.multiply(progress, artworkScale),
  );

  const artTransform = Animated.multiply(artBaseScale, pulseScale);

  const artRadius = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [MINI_ART_RADIUS / miniArtScaleValue, PLAYER_ART_RADIUS],
    extrapolate: "clamp",
  });

  const artBorderWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [MINI_ART_BORDER / miniArtScaleValue, 0.5],
    extrapolate: "clamp",
  });
  const artBorderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      theme.miniArtBorder,
      expandedOnDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)",
    ],
    extrapolate: "clamp",
  });

  const zoomLeft = Animated.add(artLeft, 8);
  const zoomTop = Animated.add(artTop, 8);
  const zoomOpacity = progress.interpolate({
    inputRange: [0.9, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const contentInteractive = isOpen;
  const showVideoLayer = isVideo && !fullscreen && videoLayerReady;

  return (
    <View
      pointerEvents="box-none"
      collapsable={false}
      // FIX: constant stacking (see styles.root). No zIndex / elevation flip.
      style={styles.root}
      onLayout={onRootLayout}
    >
      {/* ── ENTRANCE WRAPPER: clips at the tab bar top so the mini player
             slides up from BEHIND the tab bar ─────────────────────────── */}
      <View
        pointerEvents="box-none"
        collapsable={false}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          // Clip exactly at the navbar's top edge while the mini player enters.
          bottom: entranceActive
            ? insets.bottom + NAVBAR_BOTTOM_GAP + NAVBAR_HEIGHT
            : 0,
          overflow: entranceActive ? "hidden" : "visible",
        }}
      >
        <Animated.View
          pointerEvents="box-none"
          collapsable={false}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: SCREEN_H,
            transform: [{ translateY: enterTranslateY }],
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.topShadow,
              {
                top: shadowTop,
                height: MINI_SHADOW_HEIGHT,
                left: bgSide,
                right: bgSide,
                opacity: dividerOpacity,
              },
            ]}
          >
            <Svg width="100%" height={MINI_SHADOW_HEIGHT}>
              <Defs>
                <SvgLinearGradient
                  id="miniTopShadow"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                  <Stop
                    offset="0.55"
                    stopColor="#000000"
                    stopOpacity={shadowAlpha * 0.35}
                  />
                  <Stop
                    offset="1"
                    stopColor="#000000"
                    stopOpacity={shadowAlpha}
                  />
                </SvgLinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height={MINI_SHADOW_HEIGHT}
                fill="url(#miniTopShadow)"
              />
            </Svg>
          </Animated.View>

          <Animated.View
            pointerEvents="auto"
            style={[
              styles.miniContainer,
              {
                top: bgTop,
                bottom: bgBottom,
                left: bgSide,
                right: bgSide,
                borderRadius: bgRadius,
                borderWidth: miniBorderWidth,
                borderColor: miniBorderColor,
              } as any,
            ]}
          >
            {/* clipped inner layer: round corners + glass + content.
                (shadow stays on the outer view so it is not clipped) */}
            <Animated.View
              pointerEvents="box-none"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: innerRadius, overflow: "hidden" },
              ]}
            >
              {/* glass: blur + tint — fades out with the mini content */}
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { opacity: miniBgOpacity }]}
              >
                {glassFrost > 0 && (
                  <BlurView
                    intensity={glassBlurIntensity}
                    tint={glass.blurTint}
                    {...(blurTargetRef
                      ? ({
                          blurMethod: "dimezisBlurView",
                          blurTarget: blurTargetRef,
                        } as any)
                      : {})}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: glassTint },
                  ]}
                />
              </Animated.View>

              {/* Color layer: clipped to the pill's rounded top so it starts at the
      mini player's top edge and expands DOWNWARD only (never above). */}
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: innerRadius, overflow: "hidden" },
                ]}
              >
                <ColorFade color={artColor} opacity={colorOpacity} />
              </Animated.View>

              <Animated.View
                pointerEvents="box-none"
                style={[
                  styles.screenFrame,
                  {
                    top: frameTop,
                    left: frameLeft,
                    width: SCREEN_W,
                    height: SCREEN_H,
                  },
                ]}
                {...pan.panHandlers}
              >
                <View
                  collapsable={false}
                  style={[StyleSheet.absoluteFill, { zIndex: 0, elevation: 0 }]}
                  pointerEvents={sheetShown ? "auto" : "none"}
                />

                <Animated.View
                  pointerEvents={contentInteractive ? "none" : "box-none"}
                  style={[
                    styles.miniContent,
                    {
                      top: geo.miniTop,
                      height: MINI_HEIGHT,
                      opacity: miniContentOpacity,
                      transform: [{ translateY: miniContentY }],
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.songInfo}
                    activeOpacity={0.8}
                    onPress={expand}
                  >
                    <View
                      style={[
                        styles.artSpacer,
                        isVideo && {
                          width: MINI_VIDEO_W,
                          height: MINI_ART_SIZE,
                        },
                      ]}
                    />
                    <View style={styles.info}>
                      <Text
                        numberOfLines={1}
                        style={[styles.title, { color: miniText }]}
                      >
                        {miniTitle}
                      </Text>
                      {displayArtist ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.miniArtist,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {displayArtist}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handlePlayPause}
                    style={styles.btn}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    {isPlaying ? (
                      <PauseIcon size={MINI_PAUSE_ICON_SIZE} color={miniText} />
                    ) : (
                      <PlayIcon size={MINI_PLAY_ICON_SIZE} color={miniText} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleNext}
                    disabled={!canGoNext}
                    style={[styles.btn, !canGoNext && styles.btnDisabled]}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <ForwardIcon
                      size={MINI_FORWARD_ICON_SIZE}
                      color={miniText}
                    />
                  </TouchableOpacity>
                </Animated.View>

                <Animated.View
                  pointerEvents={contentInteractive ? "box-none" : "none"}
                  style={[
                    styles.blockWrap,
                    {
                      top: geo.blockTop,
                      opacity: blockOpacity,
                      transform: [{ translateY: blockY }],
                    },
                  ]}
                >
                  <ExpandedPreview
                    itemKey={itemKey}
                    isVideo={isVideo}
                    title={displayTitle}
                    artist={displayArtist}
                    isPlaying={isPlaying}
                    isFav={isFav}
                    onToggleFav={onToggleFavAny}
                    onOpenAlbum={isVideo ? undefined : openAlbum}
                    onOpenOptions={() => setShowOptions(true)}
                    playPause={handlePlayPause}
                    next={handleNext}
                    hasNext={canGoNext}
                    prev={handlePrev}
                    seek={handleSeek}
                    onDark={expandedOnDark}
                  />
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.artOverlay,
                    {
                      left: artLeft,
                      top: artTop,
                      width: artFixedSize,
                      height: artH,
                      borderRadius: artRadius,
                      borderWidth: artBorderWidth,
                      borderColor: artBorderColor,
                      transform: [{ scale: artTransform }],
                    },
                  ]}
                >
                  {isVideo ? (
                    <VideoArt
                      thumb={artworkUri}
                      width={artFixedSize}
                      height={artH}
                      expanded={isOpen}
                      showVideo={showVideoLayer}
                      player={videoPlayer}
                    />
                  ) : (
                    <SmoothArt uri={artworkUri} size={artFixedSize} />
                  )}
                </Animated.View>

                {isVideo ? (
                  <Animated.View
                    pointerEvents={contentInteractive ? "box-none" : "none"}
                    style={[
                      styles.zoomWrap,
                      { left: zoomLeft, top: zoomTop, opacity: zoomOpacity },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setFsAnimated(true);
                        enterFullscreen();
                      }}
                      style={styles.zoomBtn}
                      activeOpacity={0.75}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ExpandIcon size={18} color="#fff" />
                    </TouchableOpacity>
                  </Animated.View>
                ) : null}
              </Animated.View>

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.divider,
                  {
                    height: MINI_DIVIDER_THICKNESS,
                    backgroundColor: theme.miniDivider,
                    opacity: dividerOpacity,
                  },
                ]}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>

      {/* ── options sheet (song or video) ─────────────────────────────── */}
      <Modal
        visible={showOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowOptions(false)}
        >
          <Pressable
            style={[
              styles.optionsSheet,
              { backgroundColor: theme.popupColour },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.optionsSongRow}>
              <View
                style={[
                  styles.optionsArtwork as ImageStyle,
                  { borderColor: theme.border, overflow: "hidden" },
                ]}
              >
                <SmoothArt uri={artworkUri} size={80} />
              </View>

              <View style={styles.optionsSongInfo}>
                <Text
                  style={[styles.optionsSongTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {sheetTitle}
                </Text>
                <Text
                  style={[
                    styles.optionsSongArtist,
                    { color: theme.iconsColour },
                  ]}
                  numberOfLines={1}
                >
                  {sheetArtist}
                </Text>
                {!isVideo ? (
                  <Text
                    style={[
                      styles.optionsSongMovie,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {sheetMovie}
                  </Text>
                ) : null}
              </View>
            </View>

            <View
              style={[styles.optionsDivider, { backgroundColor: theme.border }]}
            />

            {isVideo ? (
              <View style={styles.optionsList}>
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    if (togglePin) togglePin(videoCurrent.id);
                    setShowOptions(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {videoPinned ? "Unpin Video" : "Pin Video"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    toggleVideoFav(videoCurrent.id);
                    setShowOptions(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {isFav ? "Remove from Favourites" : "Add to Favourite List"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    if (playNextFavourite) playNextFavourite();
                    setShowOptions(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    Play next Favourite video
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.optionsList}>
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => comingSoon("Pin song")}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {"Pin Song"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onToggleFavAny();
                    setShowOptions(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {isFav ? "Remove from Favourites" : "Add to Favourite List"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={openAddToPlaylist}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {"Add to Playlist"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {"Share Song"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={openSleepTimer}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {sleep.isActive
                      ? `Sleep Timer · ${formatTimer(sleep.remainingSec ?? 0)}`
                      : "Sleep Timer"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={addToOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddToOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setAddToOpen(false)}
        >
          <Pressable
            style={[
              styles.optionsSheet,
              { backgroundColor: theme.popupColour },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={[
                styles.optionsSongTitle,
                {
                  color: theme.text,
                  fontSize: 17,
                  marginBottom: 12,
                  textAlign: "center",
                },
              ]}
            >
              Add to playlist
            </Text>

            {playlists.length === 0 ? (
              <Text
                style={{
                  color: theme.textSecondary,
                  fontSize: 14,
                  fontFamily: SF.regular,
                  textAlign: "center",
                  paddingVertical: 24,
                }}
              >
                You don't have any playlists yet.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {playlists.map((pl) => (
                  <TouchableOpacity
                    key={pl.id}
                    style={[
                      styles.optionItem,
                      {
                        borderBottomColor: theme.border,
                        flexDirection: "row",
                        alignItems: "center",
                      },
                    ]}
                    onPress={() => addCurrentSongToPlaylist(pl)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 4,
                        backgroundColor:
                          (theme as any).surfaceAlt ?? theme.border,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 14,
                      }}
                    >
                      <Text
                        style={{ color: theme.textSecondary, fontSize: 18 }}
                      >
                        ♪
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={[styles.optionLabel, { color: theme.text }]}
                      >
                        {pl.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: theme.textSecondary,
                          fontSize: 12,
                          fontFamily: SF.regular,
                          marginTop: 2,
                        }}
                      >
                        {pl.songs?.length ?? 0}{" "}
                        {(pl.songs?.length ?? 0) === 1 ? "song" : "songs"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderTopColor: theme.border, marginTop: 12 },
              ]}
              onPress={() => setAddToOpen(false)}
            >
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <SleepTimerSheet
        visible={showSleep}
        onClose={() => setShowSleep(false)}
        onStart={sleep.start}
        onCancelTimer={sleep.cancel}
        remainingSec={sleep.remainingSec}
        colors={{
          surface: theme.popupColour,
          text: theme.text,
          textSecondary: theme.textSecondary,
          border: theme.border,
        }}
      />

      {/* ── fullscreen video ──────────────────────────────────────────── */}
      <Modal
        visible={fullscreen && isVideo}
        animationType={fsAnimated ? "fade" : "none"}
        onShow={handleFsShow}
        statusBarTranslucent
        navigationBarTranslucent
        transparent
        supportedOrientations={[
          "portrait",
          "portrait-upside-down",
          "landscape",
          "landscape-left",
          "landscape-right",
        ]}
        onRequestClose={() => void exitFullscreen()}
      >
        <StatusBar hidden />
        <FullscreenPlayer
          title={displayTitle}
          artist={displayArtist}
          thumbUri={artworkUri}
          onClose={() => void exitFullscreen()}
          onCollapse={() => void exitFullscreen()}
        />
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  // Constant stacking: never change zIndex / elevation at runtime.
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },

  topShadow: {
    position: "absolute",
    overflow: "hidden",
  },

  bgLayer: {
    position: "absolute",
    overflow: "hidden",
  },

  miniContainer: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "transparent",
  },

  divider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  screenFrame: {
    position: "absolute",
    elevation: 0,
  },

  miniContent: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: MINI_ART_LEFT,
    paddingRight: 16 + MINI_SIDE_MARGIN,
    zIndex: 3,
    elevation: 0,
  },
  blockWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 12,
  },

  songInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  artSpacer: {
    width: MINI_ART_SIZE,
    height: MINI_ART_SIZE,
  },

  info: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: "center",
  },

  title: {
    fontSize: 14,
    ...sfFont(SF.semibold, "600"),
  },

  miniArtist: {
    fontSize: 12,
    marginTop: 0,
    ...sfFont(SF.regular, "400"),
  },
  btn: {
    width: 40,
    height: 40,
    marginLeft: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.3,
  },
  artOverlay: {
    position: "absolute",
    overflow: "hidden",
    zIndex: 30,
    elevation: 30,
  },

  zoomWrap: {
    position: "absolute",
    left: PLAYER_ART_MARGIN + 8,
    top: PLAYER_ART_TOP + 8,
    zIndex: 40,
    elevation: 40,
  },
  zoomBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },

  artImage: {
    width: "100%",
    height: "100%",
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },

  optionsSheet: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: "85%",
  },

  optionsSongRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionsArtwork: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  optionsSongInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 16,
    justifyContent: "center",
  },
  optionsSongTitle: {
    fontSize: 15,
    lineHeight: 20,
    ...sfFont(SF.semibold, "600"),
  },
  optionsSongArtist: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
    ...sfFont(SF.regular, "400"),
  },
  optionsSongMovie: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
    ...sfFont(SF.regular, "400"),
  },

  optionsDivider: {
    height: 1,
    marginHorizontal: -20,
    marginTop: 18,
    marginBottom: 4,
  },

  optionsList: { marginBottom: 12 },
  optionRow: {
    paddingVertical: 15,
  },
  optionItem: {
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    fontSize: 16,
    ...sfFont(SF.medium, "500"),
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    ...sfFont(SF.semibold, "600"),
  },
});