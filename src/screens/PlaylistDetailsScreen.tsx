// src/screens/PlaylistDetailsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Share,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import LibraryPageHeaders from "../components/LibraryPageHeaders";
import MiniPlayer from "../components/MiniPlayer";

import { useTheme } from "../hooks/useTheme";
import { useUserName } from "../hooks/useUserName";
import { useMediaStore } from "../store/mediaStore";
import { usePlayerStore } from "../store/playerStore";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useArtworkCache } from "../hooks/useArtworkCache";
import {
  MUSIC_DEFAULT_IMAGE,
  PlayIcon,
  ShuffleIcon,
  UserPlaylistIcon,
} from "../icons/Icons";
import { showToast } from "../utils/toast";

const FONT = "sans-serif";
const STORAGE_PLAYLISTS = "@library_playlists";

const SEARCH_ICON = require("../../assets/images/search.png");
const MORE_ICON = require("../../assets/apple/moreicon.png");

const LIGHT_THEME = {
  mode: "light" as const,
  background: "#edeef0",
  surface: "#ffffff",
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
  background: "#2d2e30",
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
  lastPlayedAt?: number;
  isFeatured?: boolean;
};

type SortKey = "default" | "nameAsc" | "nameDesc" | "artistAsc" | "recent";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "nameAsc", label: "Name (A-Z)" },
  { key: "nameDesc", label: "Name (Z-A)" },
  { key: "artistAsc", label: "Artist (A-Z)" },
  { key: "recent", label: "Newest first" },
];

const getArtist = (s: any): string => {
  const candidates = [
    s?.artist,
    s?.artists,
    s?.albumArtist,
    s?.album_artist,
    s?.author,
    s?.composer,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (Array.isArray(c) && c.length > 0) {
      const joined = c.filter(Boolean).join(", ");
      if (joined) return joined;
    }
  }
  return "Unknown Artist";
};

const getArtwork = (s: any): string | undefined =>
  s?.artwork ?? s?.artworkUri ?? s?.cover ?? undefined;

const persistArtwork = async (tempUri: string): Promise<string> => {
  try {
    const dir = `${FileSystem.documentDirectory}playlist_artwork/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const ext = (tempUri.split(".").pop() || "jpg").split("?")[0];
    const dest = `${dir}pl_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: tempUri, to: dest });
    return dest;
  } catch (e) {
    console.warn("[PlaylistDetails] copy artwork failed:", e);
    return tempUri;
  }
};

export default function PlaylistDetailsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const playlistId: string = route.params?.playlistId;

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
    return { ...fallback, ...base };
  }, [base]);

  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const headerColors = useMemo(
    () => ({
      background: COLORS.background,
      surface: COLORS.surface,
      border: COLORS.border,
      text: COLORS.text,
      textSecondary: COLORS.textSecondary,
      textMuted: COLORS.textMuted,
      primary: COLORS.primary,
    }),
    [COLORS],
  );

  const userName = useUserName();

  const songs = useMediaStore((s) => s.songs);
  const favorites = useMediaStore((s) => s.favoritesSong);
  const toggleFavorite = useMediaStore((s) => s.toggleSongFavorite);
  const { loadAndPlay } = useAudioPlayer();
  const { artworkMap } = useArtworkCache(songs);

  const currentSongId = usePlayerStore(
    (s: any) => s.currentTrack?.id ?? s.currentSong?.id ?? null,
  );

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [query, setQuery] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [songMenuOpen, setSongMenuOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [addToOpen, setAddToOpen] = useState(false);
  const [otherPlaylists, setOtherPlaylists] = useState<Playlist[]>([]);

  const [addMusicOpen, setAddMusicOpen] = useState(false);
  const [addMusicQuery, setAddMusicQuery] = useState("");

  const [imageMenuOpen, setImageMenuOpen] = useState(false);

  const loadPlaylist = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const all: Playlist[] = raw ? JSON.parse(raw) : [];
      const found = all.find((p) => p.id === playlistId) ?? null;
      setPlaylist(found);
    } catch (e: any) {
      console.log("[PlaylistDetails] load error:", e?.message);
      setPlaylist(null);
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useFocusEffect(
    useCallback(() => {
      loadPlaylist();
    }, [loadPlaylist]),
  );

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  const persist = useCallback(async (next: Playlist) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const all: Playlist[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((p) => (p.id === next.id ? next : p));
      await AsyncStorage.setItem(STORAGE_PLAYLISTS, JSON.stringify(updated));
      setPlaylist(next);
    } catch (e: any) {
      console.log("[PlaylistDetails] persist error:", e?.message);
      showToast("Could not save changes");
    }
  }, []);

  const songsWithArt = useMemo(() => {
    if (!playlist?.songs) return [];
    return playlist.songs.map((s: any) => ({
      ...s,
      artwork: getArtwork(s) ?? artworkMap[s.id],
    }));
  }, [playlist, artworkMap]);

  const visibleSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? songsWithArt.filter((s) => {
          const t = (s.title ?? "").toLowerCase();
          const a = getArtist(s).toLowerCase();
          return t.includes(q) || a.includes(q);
        })
      : songsWithArt;

    const copy = [...list];

    switch (sortKey) {
      case "nameAsc":
        copy.sort((a, b) =>
          (a.title ?? "").localeCompare(b.title ?? "", undefined, {
            sensitivity: "base",
          }),
        );
        break;
      case "nameDesc":
        copy.sort((a, b) =>
          (b.title ?? "").localeCompare(a.title ?? "", undefined, {
            sensitivity: "base",
          }),
        );
        break;
      case "artistAsc":
        copy.sort((a, b) =>
          getArtist(a).localeCompare(getArtist(b), undefined, {
            sensitivity: "base",
          }),
        );
        break;
      case "recent":
        copy.reverse();
        break;
      default:
        break;
    }
    return copy;
  }, [songsWithArt, query, sortKey]);

  const totalDuration = useMemo(() => {
    let t = 0;
    for (const s of songsWithArt) {
      const d = (s as any).duration;
      if (typeof d === "number" && d > 0) t += d > 36000 ? d / 1000 : d;
    }
    return t;
  }, [songsWithArt]);

  const formatTotal = (sec: number) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
  };

  const playFromIndex = useCallback(
    async (index: number) => {
      if (visibleSongs.length === 0) return;
      try {
        await loadAndPlay(visibleSongs as any, index);
        if (playlist) {
          persist({ ...playlist, lastPlayedAt: Date.now() });
        }
      } catch (e) {
        console.error("[PlaylistDetails] play error:", e);
        showToast("Playback failed");
      }
    },
    [visibleSongs, loadAndPlay, playlist, persist],
  );

  const handlePlayAll = () => playFromIndex(0);

  const handleShuffle = () => {
    if (visibleSongs.length === 0) return;
    const shuffled = [...visibleSongs].sort(() => Math.random() - 0.5);
    loadAndPlay(shuffled as any, 0).catch(() => {
      showToast("Playback failed");
    });
  };

  const handleSongPress = (song: any) => {
    const index = visibleSongs.findIndex((s) => s.id === song.id);
    if (index < 0) return;
    playFromIndex(index);
  };

  const handleSongOptions = (song: any) => {
    setSelectedSong(song);
    setSongMenuOpen(true);
  };

  const handleRemoveFromPlaylist = async () => {
    if (!playlist || !selectedSong) return;
    const next = {
      ...playlist,
      songs: (playlist.songs ?? []).filter(
        (s: any) => s.id !== selectedSong.id,
      ),
      updatedAt: Date.now(),
    };
    await persist(next);
    setSongMenuOpen(false);
    setSelectedSong(null);
    showToast("Removed from playlist");
  };

  const handlePlayNext = () => {
    if (!selectedSong) return;
    showToast(`"${selectedSong.title}" will play next`);
    setSongMenuOpen(false);
  };

  const handleShareSong = async () => {
    if (!selectedSong) return;
    try {
      await Share.share({
        title: selectedSong.title,
        message: `🎵 ${selectedSong.title}\nBy ${getArtist(selectedSong)}`,
      });
    } catch {}
    setSongMenuOpen(false);
  };

  const handleToggleFavourite = () => {
    if (!selectedSong) return;
    const isFav = !!favorites[selectedSong.id];
    toggleFavorite(selectedSong.id);
    showToast(isFav ? "Removed from Favourites" : "Added to Favourites");
    setSongMenuOpen(false);
  };

  const handleRename = () => {
    if (!playlist) return;
    setRenameText(playlist.name);
    setMenuOpen(false);
    setTimeout(() => setRenameOpen(true), 200);
  };

  const saveRename = async () => {
    if (!playlist) return;
    const trimmed = renameText.trim();
    if (!trimmed) {
      showToast("Please enter a name");
      return;
    }
    await persist({ ...playlist, name: trimmed, updatedAt: Date.now() });
    setRenameOpen(false);
    setRenameText("");
    showToast("Renamed");
  };

  const handleDeletePlaylist = () => {
    if (!playlist) return;
    Alert.alert(
      "Delete playlist",
      `Delete "${playlist.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
              const all: Playlist[] = raw ? JSON.parse(raw) : [];
              const filtered = all.filter((p) => p.id !== playlist.id);
              await AsyncStorage.setItem(
                STORAGE_PLAYLISTS,
                JSON.stringify(filtered),
              );
              showToast("Playlist deleted");
              nav.goBack();
            } catch {
              showToast("Could not delete playlist");
            }
          },
        },
      ],
    );
    setMenuOpen(false);
  };

  const openAddToAnother = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const all: Playlist[] = raw ? JSON.parse(raw) : [];
      setOtherPlaylists(all.filter((p) => p.id !== playlist?.id));
      setSongMenuOpen(false);
      setTimeout(() => setAddToOpen(true), 200);
    } catch {
      showToast("Could not load playlists");
    }
  };

  const addToPlaylist = async (target: Playlist) => {
    if (!selectedSong) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const all: Playlist[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((p) =>
        p.id === target.id
          ? {
              ...p,
              songs: [...(p.songs ?? []), selectedSong],
              updatedAt: Date.now(),
              artwork: p.artwork ?? getArtwork(selectedSong) ?? null,
            }
          : p,
      );
      await AsyncStorage.setItem(STORAGE_PLAYLISTS, JSON.stringify(updated));
      showToast(`Added to "${target.name}"`);
      setAddToOpen(false);
      setSelectedSong(null);
    } catch {
      showToast("Could not add to playlist");
    }
  };

  const handleSharePlaylist = async () => {
    if (!playlist) return;
    try {
      const songList = (playlist.songs ?? [])
        .slice(0, 5)
        .map((s: any) => `• ${s.title}`)
        .join("\n");
      await Share.share({
        title: playlist.name,
        message: `🎵 ${playlist.name}\n\n${songList}${
          (playlist.songs?.length ?? 0) > 5
            ? `\n... and ${(playlist.songs?.length ?? 0) - 5} more`
            : ""
        }`,
      });
    } catch {}
    setMenuOpen(false);
  };

  const playlistSongIds = useMemo(() => {
    if (!playlist?.songs) return new Set<string>();
    return new Set(playlist.songs.map((s: any) => s.id));
  }, [playlist]);

  const allSongsWithArt = useMemo(() => {
    return songs.map((s: any) => {
      const title =
        s.title ||
        (s.filename ? String(s.filename).replace(/\.[^/.]+$/, "") : "") ||
        "Unknown";
      return {
        ...s,
        artwork: getArtwork(s) ?? artworkMap[s.id],
        displayTitle: title,
        displayArtist: getArtist(s),
      };
    });
  }, [songs, artworkMap]);

  const filteredAllSongs = useMemo(() => {
    const q = addMusicQuery.trim().toLowerCase();
    if (!q) return allSongsWithArt;
    return allSongsWithArt.filter(
      (s) =>
        s.displayTitle.toLowerCase().includes(q) ||
        s.displayArtist.toLowerCase().includes(q),
    );
  }, [allSongsWithArt, addMusicQuery]);

  const handleAddSongToPlaylist = useCallback(
    async (song: any) => {
      if (!playlist) return;
      if (playlistSongIds.has(song.id)) {
        showToast("Already in playlist");
        return;
      }
      const next = {
        ...playlist,
        songs: [...(playlist.songs ?? []), song],
        artwork: playlist.artwork ?? getArtwork(song) ?? null,
        updatedAt: Date.now(),
      };
      await persist(next);
      showToast(`Added "${song.displayTitle || song.title || "song"}"`);
    },
    [playlist, playlistSongIds, persist],
  );

  const updateArtwork = async (tempUri: string) => {
    if (!playlist) return;
    const saved = await persistArtwork(tempUri);
    await persist({
      ...playlist,
      artwork: saved,
      updatedAt: Date.now(),
    });
    showToast("Playlist image updated");
  };

  const handleTakePhoto = async () => {
    setImageMenuOpen(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Camera access is required to take a photo.",
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        await updateArtwork(res.assets[0].uri);
      }
    } catch (e) {
      console.warn("[PlaylistDetails] camera error:", e);
      showToast("Could not open camera");
    }
  };

  const handleChooseFromLibrary = async () => {
    setImageMenuOpen(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Photo library access is required to pick an image.",
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        await updateArtwork(res.assets[0].uri);
      }
    } catch (e) {
      console.warn("[PlaylistDetails] library error:", e);
      showToast("Could not open photos");
    }
  };

  const handleRemoveArtwork = async () => {
    if (!playlist) return;
    setImageMenuOpen(false);
    await persist({
      ...playlist,
      artwork: null,
      updatedAt: Date.now(),
    });
    showToast("Image removed");
  };

  const renderItem = ({ item }: { item: any }) => {
    const isCurrent = currentSongId === item.id;
    const isFav = !!favorites[item.id];
    const art = getArtwork(item) ?? artworkMap[item.id];

    return (
      <TouchableOpacity
        style={styles.songRow}
        activeOpacity={0.7}
        onPress={() => handleSongPress(item)}
      >
        <View style={styles.leftIcon}>
          {isCurrent ? (
            <Text style={[styles.playingDot, { color: COLORS.primary }]}>
              ♪
            </Text>
          ) : isFav ? (
            <Text style={[styles.favStar, { color: COLORS.primary }]}>
              ★
            </Text>
          ) : null}
        </View>

        <View style={styles.artWrap}>
          {art ? (
            <Image source={{ uri: art }} style={styles.art} />
          ) : (
            <Image source={MUSIC_DEFAULT_IMAGE} style={styles.art} />
          )}
        </View>

        <View style={styles.songInfo}>
          <Text
            numberOfLines={1}
            style={[
              styles.songTitle,
              { color: isCurrent ? COLORS.primary : COLORS.text },
            ]}
          >
            {item.title ?? "Unknown"}
          </Text>
          <Text numberOfLines={1} style={styles.songArtist}>
            {getArtist(item)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => handleSongOptions(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.dotsHit}
        >
          <Text style={styles.rowDots}>⋮</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: COLORS.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  if (!playlist) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: COLORS.textSecondary }}>Playlist not found</Text>
      </View>
    );
  }

  const coverArt = playlist.artwork ?? null;

  return (
    <View style={styles.container}>
      {/* ✅ Transparent floating header — back (left) · ⋮ (right) */}
      <LibraryPageHeaders
        colors={headerColors}
        topInset={insets.top}
        showBack
        onBack={() => nav.goBack()}
        title=""
        showSearch={false}
        transparent
        actions={[
          {
            key: "more",
            icon: MORE_ICON,
            iconStyle: {
              width: 18,
              height: 18,
              tintColor: COLORS.primary,
            },
            onPress: () => setMenuOpen(true),
          },
        ]}
      />

      {/* ---- List ---- */}
      <FlatList
        data={visibleSongs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 50,
          paddingBottom: 220,
        }}
        ItemSeparatorComponent={() => <View style={styles.songSep} />}
        ListHeaderComponent={
          <View>
            <View style={styles.searchWrap}>
              <Image
                source={SEARCH_ICON}
                style={[
                  styles.searchIcon,
                  { tintColor: COLORS.textSecondary },
                ]}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search in playlist"
                placeholderTextColor={COLORS.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* HERO — tap to change image */}
            <TouchableOpacity
              style={styles.heroWrap}
              onPress={() => setImageMenuOpen(true)}
              activeOpacity={0.85}
            >
              <View style={styles.heroInner}>
                {coverArt ? (
                  <Image
                    source={{ uri: coverArt }}
                    style={styles.hero}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.hero}>
                    <UserPlaylistIcon size={120} color={COLORS.primary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <Text style={styles.title} numberOfLines={2}>
              {playlist.name}
            </Text>

            {!playlist.isFeatured ? (
              <Text style={styles.ownerName}>{userName || "You"}</Text>
            ) : null}

            {totalDuration > 0 && (
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {formatTotal(totalDuration)}
                </Text>
              </View>
            )}

            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.shuffleCircle}
                onPress={handleShuffle}
                activeOpacity={0.8}
                disabled={songsWithArt.length === 0}
              >
                <ShuffleIcon size={20} color={COLORS.text} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playBtn, { backgroundColor: COLORS.text }]}
                onPress={handlePlayAll}
                activeOpacity={0.85}
                disabled={songsWithArt.length === 0}
              >
                <PlayIcon size={22} color={COLORS.background} />
                <Text
                  style={[styles.playText, { color: COLORS.background }]}
                >
                  Play
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addCircle}
                onPress={() => setAddMusicOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.addCircleText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.addMusicRow}
              activeOpacity={0.75}
              onPress={() => setAddMusicOpen(true)}
            >
              <View style={styles.addMusicPlusWrap}>
                <Text style={styles.addMusicPlus}>+</Text>
              </View>
              <Text style={styles.addMusicLabel}>Add music</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.bottomArea} pointerEvents="box-none">
        <MiniPlayer />
      </View>

      {/* Playlist image picker popup */}
      <Modal
        visible={imageMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setImageMenuOpen(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setImageMenuOpen(false)}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Playlist image</Text>

            <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
              <Text style={styles.optionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={handleChooseFromLibrary}
            >
              <Text style={styles.optionText}>Your Photos</Text>
            </TouchableOpacity>

            {playlist.artwork ? (
              <TouchableOpacity
                style={styles.option}
                onPress={handleRemoveArtwork}
              >
                <Text style={[styles.optionText, { color: "#E53935" }]}>
                  ⌫ Remove image
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setImageMenuOpen(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Playlist options sheet */}
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
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {playlist.name}
            </Text>

            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                setMenuOpen(false);
                setTimeout(() => setSortOpen(true), 200);
              }}
            >
              <Text style={styles.optionText}>🔀 Sort by</Text>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleRename}>
              <Text style={styles.optionText}>✎ Rename playlist</Text>
            </TouchableOpacity>

            

            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                setMenuOpen(false);
                handleDeletePlaylist();
              }}
            >
              <Text style={[styles.optionText, { color: "#E53935" }]}>
                ⌫ Delete playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setMenuOpen(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Song options sheet */}
      <Modal
        visible={songMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSongMenuOpen(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setSongMenuOpen(false)}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {selectedSong?.title ?? "Song options"}
            </Text>

            <TouchableOpacity style={styles.option} onPress={handlePlayNext}>
              <Text style={styles.optionText}>⏭ Play next</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={handleToggleFavourite}
            >
              <Text style={styles.optionText}>
                {selectedSong && favorites[selectedSong.id]
                  ? "♥  Remove from Favourites"
                  : "♥  Add to Favourites"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={openAddToAnother}>
              <Text style={styles.optionText}>
                ＋ Add to another playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handleShareSong}>
              <Text style={styles.optionText}>↗ Share song</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={handleRemoveFromPlaylist}
            >
              <Text style={[styles.optionText, { color: "#E53935" }]}>
                ⌫ Remove from this playlist
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setSongMenuOpen(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sort modal */}
      <Modal
        visible={sortOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortOpen(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setSortOpen(false)}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sort by</Text>

            {SORT_OPTIONS.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.option}
                  onPress={() => {
                    setSortKey(opt.key);
                    setSortOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active && { color: COLORS.primary, fontWeight: "700" },
                    ]}
                  >
                    {active ? "✓  " : "     "}
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setSortOpen(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={renameOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameOpen(false)}
      >
        <Pressable
          style={styles.modalCenterBackdrop}
          onPress={() => setRenameOpen(false)}
        >
          <Pressable
            style={styles.renameCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>Rename playlist</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              placeholder="Playlist name"
              placeholderTextColor={COLORS.textMuted}
              style={styles.renameInput}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                onPress={() => setRenameOpen(false)}
                style={styles.actionButton}
              >
                <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveRename}
                style={[
                  styles.actionButton,
                  { backgroundColor: COLORS.primary },
                ]}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add to playlist modal */}
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
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add to playlist</Text>

            {otherPlaylists.length === 0 ? (
              <Text style={styles.noPlaylists}>
                You don't have any other playlists yet.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {otherPlaylists.map((pl) => (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.playlistPick}
                    onPress={() => addToPlaylist(pl)}
                  >
                    <View style={styles.plIcon}>
                      <UserPlaylistIcon
                        size={22}
                        color={COLORS.textSecondary}
                      />
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
              onPress={() => setAddToOpen(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add music modal */}
      <Modal
        visible={addMusicOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setAddMusicOpen(false);
          setAddMusicQuery("");
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => {
              setAddMusicOpen(false);
              setAddMusicQuery("");
            }}
          />
          <View style={[styles.bottomSheet, { height: "80%" }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add music</Text>

            <View style={[styles.searchWrap, { marginHorizontal: 0 }]}>
              <Image
                source={SEARCH_ICON}
                style={[
                  styles.searchIcon,
                  { tintColor: COLORS.textSecondary },
                ]}
              />
              <TextInput
                value={addMusicQuery}
                onChangeText={setAddMusicQuery}
                placeholder="Search songs"
                placeholderTextColor={COLORS.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {addMusicQuery.length > 0 && (
                <TouchableOpacity onPress={() => setAddMusicQuery("")}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredAllSongs.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyStar}>♪</Text>
                <Text style={styles.emptyTitle}>No songs found</Text>
                <Text style={styles.emptySub}>
                  Scan your library first, then try again.
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredAllSongs}
                keyExtractor={(item: any) => String(item.id)}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 12 }}
                ItemSeparatorComponent={() => (
                  <View style={[styles.songSep, { marginLeft: 72 }]} />
                )}
                renderItem={({ item }: { item: any }) => {
                  const added = playlistSongIds.has(item.id);
                  return (
                    <TouchableOpacity
                      style={styles.pickRow}
                      activeOpacity={added ? 1 : 0.7}
                      disabled={added}
                      onPress={() => handleAddSongToPlaylist(item)}
                    >
                      <Image
                        source={
                          item.artwork
                            ? { uri: item.artwork }
                            : MUSIC_DEFAULT_IMAGE
                        }
                        style={styles.pickArt}
                      />
                      <View style={styles.pickInfo}>
                        <Text numberOfLines={1} style={styles.pickTitle}>
                          {item.displayTitle}
                        </Text>
                        <Text numberOfLines={1} style={styles.pickArtist}>
                          {item.displayArtist}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.pickAdd,
                          added && { color: COLORS.primary },
                        ]}
                      >
                        {added ? "✓" : "+"}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setAddMusicOpen(false);
                setAddMusicQuery("");
              }}
            >
              <Text style={styles.cancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (C: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { alignItems: "center", justifyContent: "center" },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 16,
      backgroundColor: C.surface,
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
      fontSize: 15,
      paddingVertical: 0,
      fontFamily: FONT,
    },
    clearIcon: { color: C.textMuted, fontSize: 14, paddingLeft: 8 },

    heroWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    heroInner: { position: "relative" },
    hero: {
      width: 220,
      height: 220,
      borderRadius: 10,
      backgroundColor: C.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 10,
      alignItems: "center",
      justifyContent: "center",
    },

    title: {
      color: C.text,
      fontSize: 20,
      fontWeight: "600",
      letterSpacing: -0.5,
      textAlign: "center",
      fontFamily: FONT,
      marginTop: -5,
      paddingHorizontal: 24,
    },
    ownerName: {
      color: C.text,
      fontSize: 20,
      fontWeight: "500",
      fontFamily: FONT,
      textAlign: "center",
      marginTop: -5,
      marginBottom: 22,
      letterSpacing: 0.2,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 6,
      marginBottom: 18,
    },
    metaText: { color: C.textSecondary, fontSize: 13, fontFamily: FONT },

    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 30,
      marginBottom: 18,
    },
    shuffleCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    playBtn: {
      width: 160,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 50,
      borderRadius: 26,
      gap: 8,
    },
    playText: { fontSize: 16, fontWeight: "700", fontFamily: FONT },

    addCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    addCircleText: {
      color: C.text,
      fontSize: 28,
      fontWeight: "300",
      lineHeight: 30,
      fontFamily: FONT,
    },

    divider: {
      height: 0.3,
      marginBottom: -10,
      backgroundColor: C.divider,
      marginHorizontal: 16,
    },

    addMusicRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    addMusicPlusWrap: {
      width: 50,
      height: 50,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
      marginRight: 14,
    },
    addMusicPlus: {
      color: "#ffffff",
      fontSize: 26,
      fontWeight: "400",
      lineHeight: 28,
      fontFamily: FONT,
    },
    addMusicLabel: {
      flex: 1,
      color: C.text,
      fontSize: 16,
      fontWeight: "500",
      fontFamily: FONT,
    },

    songRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    leftIcon: {
      width: 20,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 6,
    },
    playingDot: { fontSize: 14 },
    favStar: { fontSize: 12 },
    artWrap: { marginLeft: 0 },
    art: {
      width: 46,
      height: 46,
      borderRadius: 7,
      backgroundColor: C.surface,
    },
    songInfo: { flex: 1, marginLeft: 12, marginRight: 6 },
    songTitle: { fontSize: 15, fontWeight: "500", fontFamily: FONT },
    songArtist: {
      color: C.textSecondary,
      fontSize: 12,
      marginTop: 2,
      fontFamily: FONT,
    },
    dotsHit: { paddingHorizontal: 18, paddingVertical: 4, marginRight: 4 },
    rowDots: {
      color: C.textSecondary,
      fontSize: 18,
      fontWeight: "500",
      lineHeight: 20,
      fontFamily: FONT,
    },
    songSep: {
      height: 1,
      backgroundColor: C.rowDivider,
      marginLeft: 100,
    },

    empty: {
      alignItems: "center",
      paddingTop: 40,
      paddingBottom: 20,
      paddingHorizontal: 32,
    },
    emptyStar: { fontSize: 52, color: C.textMuted },
    emptyTitle: {
      color: C.text,
      fontSize: 18,
      fontWeight: "600",
      marginTop: 10,
      fontFamily: FONT,
    },
    emptySub: {
      color: C.textSecondary,
      fontSize: 13,
      textAlign: "center",
      marginTop: 6,
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
    modalCenterBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    bottomSheet: {
      backgroundColor: C.surface,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 28,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
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
      flexDirection: "row",
      alignItems: "center",
    },
    optionText: {
      flex: 1,
      color: C.text,
      fontSize: 16,
      fontFamily: FONT,
    },
    optionArrow: { color: C.textMuted, fontSize: 22, fontWeight: "300" },
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
      fontFamily: FONT,
    },

    renameCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 20,
      width: "100%",
      maxWidth: 380,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    renameInput: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 48,
      fontSize: 15,
      color: C.text,
      backgroundColor: C.background,
      fontFamily: FONT,
    },
    renameActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginTop: 18,
      gap: 12,
    },
    actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 9,
    },
    saveText: { color: "#ffffff", fontWeight: "700", fontFamily: FONT },

    noPlaylists: {
      color: C.textSecondary,
      fontSize: 14,
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

    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
    },
    pickArt: {
      width: 44,
      height: 44,
      borderRadius: 6,
      backgroundColor: C.surfaceLight,
    },
    pickInfo: {
      flex: 1,
      marginLeft: 12,
      marginRight: 8,
      minWidth: 0,
    },
    pickTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: "500",
      fontFamily: FONT,
    },
    pickArtist: {
      color: C.textSecondary,
      fontSize: 12,
      marginTop: 2,
      fontFamily: FONT,
    },
    pickAdd: {
      color: C.textSecondary,
      fontSize: 22,
      fontWeight: "300",
      width: 32,
      textAlign: "center",
      fontFamily: FONT,
    },
  });