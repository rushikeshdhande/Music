// src/screens/ArtistDetailsScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LibraryPageHeaders from "../components/LibraryPageHeaders";

import { useTheme } from "../hooks/useTheme";
import { useMediaStore } from "../store/mediaStore";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useArtworkCache } from "../hooks/useArtworkCache";
import { useArtistStore } from "../store/artistStore";
import { useId3Tags } from "../hooks/useId3Tags";
import { PlayIcon, ShuffleIcon } from "../icons/Icons";
import { showToast } from "../utils/toast";
import {
  resolveArtistName,
  cleanSiteName,
  UNKNOWN_ARTIST,
} from "../utils/cleanArtistName";

// ✅ Star icons
const STAR_ON = require("../../assets/images/favouritedsong.png");
const STAR_OFF = require("../../assets/images/favourite.png");

const MORE_ICON = require("../../assets/apple/moreicon.png");
const MUSIC_DEFAULT_PNG = require("../../assets/images/musicdefault.png");
const FONT = "sans-serif";
const UNKNOWN_ALBUM = "Unknown album";

// ─── Grid layout ─────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");
const GRID_COLS = 2;
const GRID_PAD = 12;
const GRID_GAP = 12;
const CARD_W =
  (SCREEN_W - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// ─── Sort options ────────────────────────────────────────────────────
type SortMode = "title" | "recent" | "newest" | "oldest";
const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "recent", label: "Recently Added" },
  { id: "newest", label: "Newest First" },
  { id: "oldest", label: "Oldest First" },
];

// ─── Module-level artwork cache ─────────────────────────────────────
const ART_CACHE_KEY = "@artist_details_art_cache_v1";
const artCache: Record<string, string> = {};
let artCacheLoaded = false;
let artCacheLoadPromise: Promise<void> | null = null;
let artSaveTimer: ReturnType<typeof setTimeout> | null = null;

const hydrateArtCache = (): Promise<void> => {
  if (artCacheLoaded) return Promise.resolve();
  if (artCacheLoadPromise) return artCacheLoadPromise;
  artCacheLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(ART_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          Object.assign(artCache, parsed);
        }
      }
    } catch {}
    artCacheLoaded = true;
  })();
  return artCacheLoadPromise;
};

const persistArtCache = () => {
  if (artSaveTimer) return;
  artSaveTimer = setTimeout(() => {
    artSaveTimer = null;
    AsyncStorage.setItem(ART_CACHE_KEY, JSON.stringify(artCache)).catch(
      () => {},
    );
  }, 1200);
};

// ✅ Music-note SVG placeholder
const ArtistPlaceholder = ({
  color = "#f92c47",
  size = 24,
}: {
  color?: string;
  size?: number;
}) => (
  <Svg width={size} height={size} viewBox="3.5 4 17 16" fill="none">
    <Path
      fill={color}
      d="M18.39 9.42c1.289-1.282 1.34-2.908.102-4.139-1.23-1.216-2.85-1.186-4.138.103zm-6.08 9.858a.66.66 0 0 0 .667-.667v-4.328l-.051-1.048 2.234-2.072c.842.11 1.728-.235 2.49-1.004l-4.03-4.035c-.776.761-1.098 1.633-.988 2.475l-6.805 7.332c-.278.3-.322.717.022 1.062L4.913 18.2a.31.31 0 0 0 .037.418l.212.22a.31.31 0 0 0 .425.029l1.208-.945c.33.344.755.3 1.048.022l3.8-3.516v4.182a.66.66 0 0 0 .667.667zm-5.053-2.073-.674-.674 6.453-6.84q.186.307.461.593.274.276.571.476z"
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
    song?.date,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
    if (typeof c === "string") {
      const t = Date.parse(c);
      if (!isNaN(t)) return t;
    }
  }
  const id = String(song?.id ?? "");
  const m = id.match(/\d{10,}/);
  if (m) return parseInt(m[0], 10) || 0;
  return 0;
};

const shuffleArr = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function ArtistDetailsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const artistName: string = route.params?.artistName ?? UNKNOWN_ARTIST;

  const songs = useMediaStore((s: any) => s.songs ?? []);
  const { loadAndPlay } = useAudioPlayer();
  const { artworkMap } = useArtworkCache(songs);
  const { tagData } = useId3Tags(songs);

  const favourites = useArtistStore((s) => s.favourites);
  const toggleFavourite = useArtistStore((s) => s.toggleFavourite);
  const hydrate = useArtistStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [menuVisible, setMenuVisible] = useState(false);

  const [cachedArt, setCachedArt] = useState<Record<string, string>>(() => ({
    ...artCache,
  }));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    hydrateArtCache().then(() => {
      if (mounted.current) setCachedArt({ ...artCache });
    });
  }, []);

  useEffect(() => {
    let changed = false;
    Object.keys(artworkMap).forEach((id) => {
      const uri = artworkMap[id];
      if (uri && artCache[id] !== uri) {
        artCache[id] = uri;
        changed = true;
      }
    });
    if (changed) {
      setCachedArt({ ...artCache });
      persistArtCache();
    }
  }, [artworkMap]);

  const artistSongs = useMemo(() => {
    const list = songs.filter(
      (s: any) =>
        resolveArtistName(s.artist, tagData[s.id]?.artist) === artistName,
    );
    const indexed = list.map((song: any, i: number) => ({
      song,
      i,
      ts: getTimestamp(song),
      title: (song.title || "").toString(),
    }));

    switch (sortMode) {
      case "title":
        indexed.sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
        );
        break;
      case "newest":
        indexed.sort((a, b) => b.ts - a.ts || b.i - a.i);
        break;
      case "oldest":
        indexed.sort((a, b) => a.ts - b.ts || a.i - b.i);
        break;
      case "recent":
      default:
        indexed.sort((a, b) => b.i - a.i);
        break;
    }

    return indexed.map((x) => x.song);
  }, [songs, artistName, sortMode, tagData]);

  const isFav = !!favourites[artistName];

  const headerColors = useMemo(
    () => ({
      background: theme.background,
      surface: theme.surface,
      border: theme.border,
      text: theme.text,
      textSecondary: theme.textSecondary,
      textMuted: (theme as any).textMuted || theme.textSecondary,
      primary: theme.primary,
    }),
    [theme]
  );

  const buildPlayableQueue = (source: any[]) =>
    source.map((s: any) => {
      const id = s.id || s._id;
      const art =
        (s as any).artwork ??
        (s as any).artworkUri ??
        artworkMap[id] ??
        cachedArt[id];
      return {
        ...s,
        artwork: art,
        artworkUri: art,
        cover: art,
        artist: resolveArtistName(s.artist, tagData[id]?.artist),
        album:
          cleanSiteName(tagData[id]?.album || (s as any).album, false) ||
          UNKNOWN_ALBUM,
      };
    });

  const playAll = async (shuffle: boolean) => {
    if (!artistSongs.length) return;
    const baseQueue = shuffle ? shuffleArr(artistSongs) : artistSongs;
    const queue = buildPlayableQueue(baseQueue);
    try {
      await loadAndPlay(queue, 0);
    } catch {
      showToast("Playback failed");
    }
  };

  const playSong = async (song: any) => {
    const idx = artistSongs.findIndex((s: any) => s.id === song.id);
    if (idx < 0) return;
    const playable = buildPlayableQueue(artistSongs);
    try {
      await loadAndPlay(playable, idx);
    } catch {
      showToast("Playback failed");
    }
  };

  const renderSong = ({ item }: { item: any }) => {
    const id = item.id || item._id;
    const art =
      (item as any).artwork ??
      (item as any).artworkUri ??
      artworkMap[id] ??
      cachedArt[id];

    const albumName =
      cleanSiteName(tagData[id]?.album || (item as any).album, false) ||
      UNKNOWN_ALBUM;

    return (
      <TouchableOpacity
        style={[styles.gridCard, { width: CARD_W }]}
        activeOpacity={0.75}
        onPress={() => playSong(item)}
      >
        <View
          style={[
            styles.gridArt,
            {
              width: CARD_W,
              height: CARD_W,
              backgroundColor: theme.surface,
            },
          ]}
        >
          <Image
            source={art ? { uri: art } : MUSIC_DEFAULT_PNG}
            style={styles.gridArtImg}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>

        <Text
          numberOfLines={1}
          style={[styles.gridTitle, { color: theme.text }]}
        >
          {item.title || "Unknown"}
        </Text>

        <Text
          numberOfLines={1}
          style={[styles.gridSub, { color: theme.textSecondary }]}
        >
          {albumName}
        </Text>
      </TouchableOpacity>
    );
  };

  const songCountLine = `${artistSongs.length} ${
    artistSongs.length === 1 ? "song" : "songs"
  }`;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      {/* ✅ Floating header — back (left) · ★ · ⋮ (right) */}
      <LibraryPageHeaders
        colors={headerColors}
        topInset={0}
        showBack
        onBack={() => nav.goBack()}
        title=""
        showSearch={false}
    
        actions={[
          {
            key: "fav",
            icon: isFav ? STAR_ON : STAR_OFF,
            iconStyle: { width: 20, height: 20 },
            onPress: () => toggleFavourite(artistName),
          },
          {
            key: "more",
            icon: MORE_ICON,
            iconStyle: {
              width: 18,
              height: 18,
              tintColor: theme.primary,
            },
            onPress: () => setMenuVisible(true),
          },
        ]}
      />

      <FlatList
        data={artistSongs}
        keyExtractor={(item: any) => item.id}
        renderItem={renderSong}
        extraData={cachedArt}
        numColumns={GRID_COLS}
        columnWrapperStyle={{
          paddingHorizontal: GRID_PAD,
          gap: GRID_GAP,
          marginBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 100 }}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <View
                style={[
                  styles.artistImgWrap,
                  { backgroundColor: theme.surface },
                ]}
              >
                <ArtistPlaceholder color={theme.primary} size={68} />
              </View>

              <Text
                style={[styles.artistName, { color: theme.text }]}
                numberOfLines={2}
              >
                {artistName}
              </Text>

              <Text
                style={[styles.heroMeta, { color: theme.textSecondary }]}
              >
                {songCountLine}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: theme.surface },
                ]}
                activeOpacity={0.75}
                onPress={() => playAll(false)}
              >
                <PlayIcon size={20} color={theme.primary} />
                <Text
                  style={[styles.actionLabel, { color: theme.primary }]}
                >
                  Play
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: theme.surface },
                ]}
                activeOpacity={0.75}
                onPress={() => playAll(true)}
              >
                <ShuffleIcon size={20} color={theme.primary} />
                <Text
                  style={[styles.actionLabel, { color: theme.primary }]}
                >
                  Shuffle
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No songs
            </Text>
            <Text
              style={[styles.emptyText, { color: theme.textSecondary }]}
            >
              This artist has no songs in your library.
            </Text>
          </View>
        }
      />

      {/* ─── Sort By — bottom sheet (slides up from bottom) ─────────────── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setMenuVisible(false)}
          />

          <View
            style={[
              styles.sortSheet,
              {
                backgroundColor: theme.surface,
                paddingBottom: insets.bottom + 16,
                borderTopColor: theme.border,
              },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: theme.border }]}
            />

            <Text
              style={[
                styles.sheetTitle,
                { color: theme.textSecondary },
              ]}
            >
              Sort By
            </Text>

            {SORT_OPTIONS.map((opt) => {
              const active = sortMode === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.sortOption}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSortMode(opt.id);
                    setMenuVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      { color: active ? theme.primary : theme.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active && (
                    <Text
                      style={{
                        color: theme.primary,
                        fontSize: 18,
                        fontWeight: "700",
                      }}
                    >
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}

             
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero
  hero: {
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 14,
  },
  artistImgWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  artistName: {
    fontSize: 22,
    fontWeight: "800",
    fontFamily: FONT,
    textAlign: "center",
    letterSpacing: -0.3,
    marginTop: 14,
    paddingHorizontal: 24,
  },
  heroMeta: {
    fontSize: 13,
    marginTop: 6,
    fontFamily: FONT,
  },

  // Actions
  actionRow: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginBottom: 18,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  actionLabel: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: FONT,
  },

  // Grid
  gridCard: { marginBottom: 0 },
  gridArt: {
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  gridArtImg: { width: "100%", height: "100%" },
  gridTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    fontFamily: FONT,
  },
  gridSub: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: FONT,
  },

  empty: { paddingHorizontal: 24, paddingTop: 40, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: FONT },
  emptyText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    fontFamily: FONT,
  },

  // ── Sort bottom sheet ─────────────────────────────────────────────
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sortSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetHandle: {
    // width: 42,
    // height: 5,
    // borderRadius: 3,
    // alignSelf: "center",
    // marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    textTransform: "capitalize",
    letterSpacing: 0.8,
    textAlign: "center",
    paddingHorizontal: 4,
    paddingBottom: 8,
    fontFamily: FONT,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: FONT,
  },
  
});