// src/screens/AlbumScreen.tsx
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
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Image,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../hooks/useTheme";
import { useMediaStore } from "../store/mediaStore";
import { useMediaScanner } from "../hooks/useMediaScanner";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useArtworkCache } from "../hooks/useArtworkCache";
import { showToast } from "../utils/toast";
import { PlayIcon, ShuffleIcon } from "../icons/Icons";

// ✅ Shared header (top bar + title + search)
import LibraryPageHeaders from "../components/LibraryPageHeaders";

// ✅ Shared centered loader
import { ScreenLoader } from "../components/Loader";

import {
  AudioTags,
  getCachedTags,
  getCachedArtwork,
  hasCachedTags,
  readAndCacheTags,
  setCachedArtwork,
} from "../services/audioTags/tagService";

const FONT = "sans-serif";
const ACTION_RADIUS = 26;
const ACTION_HEIGHT = 52;
const SEARCH_FONT_SIZE = 18;
const ACTION_TOP_GAP = 22;

const MUSIC_DEFAULT_PNG = require("../../assets/images/musicdefault.png");
const LIST_ICON = require("../../assets/images/list.png");

const UNKNOWN_ALBUM = "Unknown album";
const UNKNOWN_ARTIST = "Unknown artist";

const TAG_CONCURRENCY = 12;
const TAG_WAIT_MS = 600;
const MIN_BOOT_LOADER_MS = 320;

const cleanName = (raw?: string | null, fallback = ""): string => {
  if (!raw) return fallback;
  let s = String(raw)
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

const GENERIC_FOLDERS =
  /^(music|audio|sdcard|emulated|0|1|download|downloads|songs|tracks|whatsapp|telegram|recordings|dcim|internal|external|storage)$/i;

const albumFromUri = (uri?: string | null): string | undefined => {
  if (!uri) return undefined;
  try {
    const clean = uri.split("?")[0].split("#")[0];
    const parts = clean.split("/").filter(Boolean);
    if (parts.length < 2) return undefined;
    const folder = decodeURIComponent(parts[parts.length - 2]).trim();
    if (!folder || GENERIC_FOLDERS.test(folder)) return undefined;
    return folder;
  } catch {
    return undefined;
  }
};

interface AlbumItem {
  key: string;
  name: string;
  artist: string;
  artwork?: string;
  songs: any[];
}

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── Theme-aware default album artwork with error fallback ──────────
const DefaultAlbumArt = React.memo(function DefaultAlbumArt({
  size,
  radius = 10,
}: {
  size: number;
  radius?: number;
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
        borderRadius: radius,
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
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{
            color: textColor,
            fontSize: size * 0.4,
            fontWeight: "700",
          }}
        >
          ♪
        </Text>
      )}
    </View>
  );
});

// ── Safe album image — falls back to default when URI is broken ────
const SafeAlbumImage = React.memo(function SafeAlbumImage({
  uri,
  size,
  radius = 10,
}: {
  uri: string;
  size: number;
  radius?: number;
}) {
  const [failed, setFailed] = React.useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (failed) {
    return <DefaultAlbumArt size={size} radius={radius} />;
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      resizeMode="cover"
      fadeDuration={0}
      onError={() => setFailed(true)}
    />
  );
});

export default function AlbumScreen() {
  const theme = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const BG_COLOR = theme.background;
  const SURFACE_COLOR = theme.surface;
  const BORDER_COLOR = theme.border;
  const ACCENT = theme.iconsColour;

  const { width: winW } = useWindowDimensions();
  const H_PAD = 12;
  const GAP = 12;
  const CARD_W = (winW - H_PAD * 2 - GAP) / 2;

  const songs = useMediaStore((s) => s.songs ?? []);
  const { scanAll } = useMediaScanner();
  const { loadAndPlay } = useAudioPlayer();
  const { artworkMap } = useArtworkCache(songs);

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(() => songs.length === 0);
  const refreshBusy = useRef(false);
  const initialScanStarted = useRef(false);
  const mounted = useRef(true);

  // ✅ Boot minimum — forced visible time on mount.
  const [bootMinDone, setBootMinDone] = useState(false);
  useEffect(() => {
    if (MIN_BOOT_LOADER_MS <= 0) {
      setBootMinDone(true);
      return;
    }
    const t = setTimeout(() => setBootMinDone(true), MIN_BOOT_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  // Seed tagData + tagsReady synchronously from the cache
  const [tagData, setTagData] = useState<Record<string, AudioTags>>(() => {
    const init: Record<string, AudioTags> = {};
    songs.forEach((s: any) => {
      if (hasCachedTags(s.id)) init[s.id] = getCachedTags(s.id) ?? {};
    });
    return init;
  });

  const [tagsReady, setTagsReady] = useState(
    () => songs.length > 0 && songs.every((s: any) => hasCachedTags(s.id)),
  );

  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Warm artwork cache so AlbumDetails reads it synchronously
  useEffect(() => {
    Object.keys(artworkMap).forEach((id) => {
      const uri = artworkMap[id];
      if (uri) setCachedArtwork(id, uri);
    });
  }, [artworkMap]);

  // ── Initial scan ────────────────────────────────────────────────────
  useEffect(() => {
    if (initialScanStarted.current) return;
    initialScanStarted.current = true;
    if (songs.length > 0) {
      setScanning(false);
      return;
    }
    setScanning(true);
    scanAll()
      .catch(console.error)
      .finally(() => {
        if (mounted.current) setScanning(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (songs.length > 0) setScanning(false);
  }, [songs.length]);

  // ── Read ID3 tags in parallel ───────────────────────────────────────
  useEffect(() => {
    if (songs.length === 0) return;

    const initial: Record<string, AudioTags> = {};
    const missing: any[] = [];

    songs.forEach((s: any) => {
      if (hasCachedTags(s.id)) {
        initial[s.id] = getCachedTags(s.id) ?? {};
      } else if (!requestedRef.current.has(s.id)) {
        missing.push(s);
      }
    });

    if (Object.keys(initial).length > 0) {
      setTagData((prev) => ({ ...prev, ...initial }));
    }

    if (missing.length === 0) {
      setTagsReady(true);
      return;
    }

    missing.forEach((s) => requestedRef.current.add(s.id));

    (async () => {
      let batch: Record<string, AudioTags> = {};
      let count = 0;
      let cursor = 0;

      const flush = () => {
        if (Object.keys(batch).length > 0 && mounted.current) {
          const toSave = batch;
          setTagData((prev) => ({ ...prev, ...toSave }));
          batch = {};
        }
      };

      const worker = async () => {
        while (cursor < missing.length && mounted.current) {
          const s = missing[cursor++];
          const uri = (s as any).uri ?? (s as any).path;
          try {
            batch[s.id] = uri ? await readAndCacheTags(s.id, uri) : {};
          } catch {
            batch[s.id] = {};
          }
          count++;
          if (count % 10 === 0) flush();
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(TAG_CONCURRENCY, missing.length) },
          () => worker(),
        ),
      );
      flush();

      if (mounted.current) setTagsReady(true);
    })();
  }, [songs]);

  // Safety timeout
  useEffect(() => {
    if (tagsReady) return;
    if (songs.length === 0) return;
    if (songs.every((s: any) => hasCachedTags(s.id))) {
      setTagsReady(true);
      return;
    }
    const t = setTimeout(() => {
      if (mounted.current) setTagsReady(true);
    }, TAG_WAIT_MS);
    return () => clearTimeout(t);
  }, [songs, tagData, tagsReady]);

  // ── Group songs → albums ───────────────────────────────────────────
  const albums = useMemo<AlbumItem[]>(() => {
    const map = new Map<string, AlbumItem>();

    songs.forEach((song: any) => {
      const tagged = tagData[song.id];
      const cached = getCachedTags(song.id);
      const uri = song.uri ?? song.path;

      const rawAlbum =
        (tagged?.album && tagged.album.trim()) ||
        (cached?.album && cached.album.trim()) ||
        (typeof song.album === "string" && song.album.trim()) ||
        albumFromUri(uri);

      const rawArtist =
        (tagged?.artist && tagged.artist.trim()) ||
        (cached?.artist && cached.artist.trim()) ||
        (typeof song.artist === "string" && song.artist.trim()) ||
        albumFromUri(
          uri ? uri.split("/").slice(0, -1).join("/") : undefined,
        );

      const name = cleanName(rawAlbum, UNKNOWN_ALBUM);
      const key = name.toLowerCase();
      const art =
        song.artwork ?? artworkMap[song.id] ?? getCachedArtwork(song.id);
      const artist = cleanName(rawArtist, "");

      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          artist: !isUnknownArtist(artist) ? artist : UNKNOWN_ARTIST,
          artwork: art,
          songs: [],
        });
      }
      const entry = map.get(key)!;
      entry.songs.push(song);
      if (!entry.artwork && art) entry.artwork = art;
      if (entry.artist === UNKNOWN_ARTIST && !isUnknownArtist(artist)) {
        entry.artist = artist;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [songs, artworkMap, tagData]);

  const filteredAlbums = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter((a) =>
      `${a.name} ${a.artist}`.toLowerCase().includes(q),
    );
  }, [albums, search]);

  const allSongsInView = useMemo(
    () => filteredAlbums.flatMap((a) => a.songs),
    [filteredAlbums],
  );

  const playAll = useCallback(
    async (shuffle: boolean) => {
      if (allSongsInView.length === 0) {
        showToast("No albums to play");
        return;
      }
      const queue = shuffle ? shuffleArray(allSongsInView) : allSongsInView;
      try {
        await loadAndPlay(queue, 0);
      } catch {
        showToast("Playback failed");
      }
    },
    [allSongsInView, loadAndPlay],
  );

  const onRefresh = useCallback(async () => {
    if (refreshBusy.current) return;
    refreshBusy.current = true;
    setRefreshing(true);
    try {
      await scanAll();
      showToast("Library refreshed");
    } catch {
      showToast("Unable to scan");
    } finally {
      refreshBusy.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [scanAll]);

  // ── Row item ───────────────────────────────────────────────────────
  const renderAlbum = useCallback(
    ({ item }: { item: AlbumItem }) => {
      const isDark = theme.mode === "dark";
      const artBorder = isDark
        ? "rgba(255,255,255,0.12)"
        : "rgba(0,0,0,0.10)";

      return (
        <TouchableOpacity
          style={[styles.albumCard, { width: CARD_W }]}
          activeOpacity={0.82}
          onPress={() =>
            nav.navigate("AlbumDetails", {
              albumName: item.name,
              songIds: item.songs.map((s: any) => s.id),
            })
          }
        >
          <View style={[styles.albumArtWrap, { width: CARD_W, height: CARD_W }]}>
            {item.artwork ? (
              <SafeAlbumImage uri={item.artwork} size={CARD_W} radius={10} />
            ) : (
              <DefaultAlbumArt size={CARD_W} radius={10} />
            )}

            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: 10,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: artBorder,
                },
              ]}
            />
          </View>

          <Text
            numberOfLines={1}
            style={[styles.albumName, { color: theme.text }]}
          >
            {item.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.albumArtist, { color: theme.textSecondary }]}
          >
            {item.artist}
          </Text>
        </TouchableOpacity>
      );
    },
    [CARD_W, theme, nav],
  );

  // ✅ Only the Play/Shuffle action row remains in the list header.
  //    Title + search now live in the shared LibraryPageHeaders.
  const listHeader = (
    <View style={styles.headerSection}>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: SURFACE_COLOR }]}
          activeOpacity={0.75}
          onPress={() => playAll(false)}
        >
          <PlayIcon size={20} color={ACCENT} />
          <Text style={[styles.actionLabel, { color: ACCENT }]}>Play</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: SURFACE_COLOR }]}
          activeOpacity={0.75}
          onPress={() => playAll(true)}
        >
          <ShuffleIcon size={20} color={ACCENT} />
          <Text style={[styles.actionLabel, { color: ACCENT }]}>Shuffle</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.listDivider, { backgroundColor: BORDER_COLOR }]} />
    </View>
  );

  // ✅ Loader visibility rule (unchanged)
  const showLoading =
    !bootMinDone || scanning || (songs.length > 0 && !tagsReady);

  return (
    <View style={[styles.container, { backgroundColor: BG_COLOR }]}>
      {/* ---------- SHARED HEADER (top bar + title + search) ---------- */}
      <LibraryPageHeaders
        colors={theme}
        topInset={insets.top}
        title="Albums"
        onBack={() => nav.goBack()}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search albums, artists"
        actions={[
          {
            key: "settings",
            icon: LIST_ICON,
            iconStyle: { width: 23, height: 20 },
            onPress: () => nav.navigate("Settings"),
          },
        ]}
      />

      <View
        style={[styles.listWrap, { opacity: showLoading ? 0 : 1 }]}
        pointerEvents={showLoading ? "none" : "auto"}
      >
        <FlatList
          key="albums-grid"
          data={filteredAlbums}
          numColumns={2}
          keyExtractor={(it) => it.key}
          ListHeaderComponent={listHeader}
          renderItem={renderAlbum}
          columnWrapperStyle={{
            paddingHorizontal: H_PAD,
            justifyContent: "space-between",
          }}
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {albums.length === 0 ? "No albums found" : "No matching albums"}
              </Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {albums.length === 0
                  ? "Pull down to scan your device again."
                  : "Try another album or artist name."}
              </Text>
            </View>
          }
        />
      </View>

      <ScreenLoader visible={showLoading} />
    </View>
  );
}

// ============================================================
// Styles — header styles removed (now in LibraryPageHeaders)
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  listWrap: { flex: 1 },

  headerSection: { paddingHorizontal: 12, paddingTop: 6 },

  actionRow: { flexDirection: "row", marginTop: ACTION_TOP_GAP },

  actionBtn: {
    flex: 1,
    height: ACTION_HEIGHT,
    borderRadius: ACTION_RADIUS,
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
  listDivider: {
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.9,
    marginTop: 16,
    marginBottom: 12,
  },

  albumCard: {
    alignItems: "flex-start",
  },
  albumArtWrap: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1c1c1e",
  },
  albumName: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: FONT,
    width: "100%",
  },
  albumArtist: {
    marginTop: 2,
    fontSize: 12.5,
    fontFamily: FONT,
    width: "100%",
  },

  empty: {
    flex: 1,
    minHeight: 300,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: FONT,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: FONT,
    textAlign: "center",
  },
});