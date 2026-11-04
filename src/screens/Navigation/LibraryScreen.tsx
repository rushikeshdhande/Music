// src/screens/Navigation/LibraryScreen.tsx
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Alert,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
} from "react-native";

import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DraggableFlatList, {
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import TrackPlayer from 'react-native-track-player';
import Header from "../../components/Header";
// 👇 Import TopStatusGlass
import TopStatusGlass from "../../components/TopStatusGlass";
import { useTheme } from "../../hooks/useTheme";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { useMediaStore } from "../../store/mediaStore";
import { usePlayerStore } from "../../store/playerStore";
import { useMediaScanner } from "../../hooks/useMediaScanner";
import { useArtworkCache } from "../../hooks/useArtworkCache";
import { useId3Tags } from "../../hooks/useId3Tags";
import { showToast } from "../../utils/toast";

import { UserPlaylistIcon } from "../../icons/Icons";

const FONT = "sans-serif";

const DIVIDER_HEIGHT = 0.3;
const CONTENT_H_PADDING = 20;
const HEADER_SPACER = 90;

const LOADER_COLOR = "#f92c47";
const LOADER_HEIGHT = 2.5;
const LOADER_TRACK_ALPHA = 0.28;

const PLAYLIST_PREVIEW_LIMIT = 4;

const MIN_LOADER_VISIBLE_MS = 120;
const TAG_WAIT_MS = 400;

export const LibraryIcon = ({
  color = "#fff",
  size = 24,
}: {
  color?: string;
  size?: number;
}) => (
  <Image
    source={require("../../../assets/icons/library.png")}
    style={{ width: size, height: size, tintColor: color }}
    resizeMode="contain"
    fadeDuration={0}
  />
);

export const StarFillIcon = ({
  color = "#f92c47",
  size = 18,
}: {
  color?: string;
  size?: number;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={color}
    />
  </Svg>
);

export const AlbumsSvgIcon = ({
  color = "#f92c47",
  size = 24,
}: {
  color?: string;
  size?: number;
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden={true}
    fill="none"
  >
    <Path
      fill={color}
      d="M15.477 3.937c-.044-.61-.396-.937-1.07-.937H9.431c-.675 0-1.027.327-1.07.937h7.115zm1.24 2.013c-.11-.654-.425-1.025-1.159-1.025H8.222c-.741 0-1.057.37-1.167 1.025zm-.3 14.05c1.313 0 2.083-.756 2.083-2.252v-8.37c0-1.496-.778-2.252-2.304-2.252H7.804Q5.502 7.124 5.5 9.38v8.369C5.5 19.244 6.27 20 7.804 20h8.612zm-.023-1.17H7.818c-.733 0-1.137-.392-1.137-1.148V9.437c0-.756.404-1.14 1.137-1.14h8.356c.727 0 1.145.384 1.145 1.14v8.245c0 .756-.418 1.148-.925 1.148"
    />
  </Svg>
);

const HorizontalLoader = React.memo(function HorizontalLoader({
  color = LOADER_COLOR,
  height = LOADER_HEIGHT,
}: {
  color?: string;
  height?: number;
}) {
  const [trackW, setTrackW] = useState(200);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trackW <= 0) return;
    slide.setValue(0);
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      slide.setValue(0);
    };
  }, [trackW, slide]);

  const barW = Math.max(trackW * 0.35, 40);
  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-barW, trackW],
  });

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - trackW) > 0.5) setTrackW(w);
      }}
      style={{
        width: "100%",
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        backgroundColor: `rgba(249,44,71,${LOADER_TRACK_ALPHA})`,
      }}
    >
      <Animated.View
        style={{
          width: barW,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          transform: [{ translateX }],
        }}
      />
    </View>
  );
});

const DEFAULT_COLORS = {
  background: "#000000",
  surface: "#1c1c1e",
  surfaceLight: "#2c2c2e",
  card: "#1c1c1e",
  border: "#3a3a3c",
  divider: "#575757ad",
  text: "#ffffff",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  primary: "#f92c47",
};

const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const BORDER_RADIUS = { sm: 6, md: 10, lg: 16, md_plus: 12 };

const { width: SCREEN_W } = Dimensions.get("window");

const PLAYLIST_ICON = require("../../../assets/icons/fd85b8b718f154e95ab8e753a702e042.png");
const SONG_ICON = require("../../../assets/icons/song.png");
const MUSIC_DEFAULT_PNG = require("../../../assets/images/musicdefault.png");
const MUSIC_VIDEO_ICON = require("../../../assets/images/MusicVideo.png");
const FAVOURITE_HERO = require("../../../assets/images/favouritepageimage.png");

const STORAGE_LIBRARY_ORDER = "library_order";
const STORAGE_LIBRARY_VISIBLE = "library_visible";
const STORAGE_PLAYLISTS = "@library_playlists";
const STORAGE_PINNED_SONGS = "@library_pinned_songs";

const ROUTE_MAP: Record<string, string> = {
  playlists: "Playlists",
  albums: "Albums",
  artists: "Artists",
  songs: "Songs",
  favSongs: "FavouriteSongs",
  musicVideos: "MusicVideos",
};

const DEFAULT_ITEMS: any[] = [
  { id: "playlists", label: "Playlists", type: "png", source: PLAYLIST_ICON },
  { id: "albums", label: "Albums", type: "albumsvg", size: 33 },
  { id: "artists", label: "Artists", type: "artists", size: 26 },
  { id: "songs", label: "Songs", type: "song", source: SONG_ICON, size: 26 },
  {
    id: "musicVideos",
    label: "Music Videos",
    type: "png",
    source: MUSIC_VIDEO_ICON,
    size: 33,
  },
];

const INITIAL_VISIBLE: Record<string, boolean> = (() => {
  const m: Record<string, boolean> = {};
  DEFAULT_ITEMS.forEach((it) => {
    m[it.id] = true;
  });
  return m;
})();

export const AlbumIcon = ({
  color = "#fff",
  size = 24,
}: {
  color?: string;
  size?: number;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
      fill={color}
    />
    <Path
      d="M12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"
      fill={color === "#fff" ? "#000" : "#fff"}
      opacity={0.55}
    />
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

const UNKNOWN_ARTIST = "Unknown artist";

const isUnknownArtist = (a?: string | null): boolean => {
  if (!a) return true;
  const t = a.trim();
  if (!t) return true;
  return /^<?\s*unknown(\s+artist)?\s*>?$/i.test(t);
};

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
    console.warn("[Library] copy artwork failed:", e);
    return tempUri;
  }
};

const getSongTimestamp = (song: any): number => {
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
  const id = String(song?.id ?? song?._id ?? "");
  const m = id.match(/\d{10,}/);
  if (m) {
    const n = parseInt(m[0], 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

type UserPlaylist = {
  id: string;
  name: string;
  artwork?: string | null;
  songs?: any[];
  createdAt?: number;
  updatedAt?: number;
  pinned?: boolean;
  favourite?: boolean;
};

type MergedItem =
  | { kind: "song"; key: string; ts: number; song: any }
  | { kind: "playlist"; key: string; ts: number; playlist: UserPlaylist }
  | { kind: "fav"; key: string; ts: number };

export default function LibraryScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const audio = useAudioPlayer() as any;
  const { loadAndPlay, currentSong } = audio;

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
  const styles = createStyles(COLORS);

  const songs = useMediaStore((s: any) => s.songs ?? []);
  const favorites: Record<string, boolean> = useMediaStore(
    (s: any) => s.favoritesSong ?? {},
  );
  const { scanAll } = useMediaScanner() as any;
  const { artworkMap } = useArtworkCache(songs);
  const { tagData } = useId3Tags(songs);

  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);

  const [playlistTitle, setPlaylistTitle] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [imageMenuOpen, setImageMenuOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<any[]>(DEFAULT_ITEMS);
  const [visibleMap, setVisibleMap] =
    useState<Record<string, boolean>>(INITIAL_VISIBLE);

  const [pinnedSongIds, setPinnedSongIds] = useState<Record<string, boolean>>(
    {},
  );
  const [isEditingPins, setIsEditingPins] = useState(false);
  const [editPinnedSongIds, setEditPinnedSongIds] = useState<
    Record<string, boolean>
  >({});
  const [editPinnedPlaylistIds, setEditPinnedPlaylistIds] = useState<
    Record<string, boolean>
  >({});

  const [contextSong, setContextSong] = useState<any | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const mounted = useRef(true);

  const [scanning, setScanning] = useState(songs.length === 0);
  const scanStarted = useRef(false);

  const [tagsReady, setTagsReady] = useState(
    () => songs.length > 0 && Object.keys(tagData || {}).length > 0,
  );
  const [artReady, setArtReady] = useState(
    () => songs.length > 0 && Object.keys(artworkMap || {}).length > 0,
  );

  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    loadSavedLibraryConfig();
    loadPinnedSongs();
  }, []);

  const loadPinnedSongs = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PINNED_SONGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setPinnedSongIds(parsed);
        }
      }
    } catch (e) {
      console.warn("[Library] load pinned songs failed:", e);
    }
  };

  const loadUserPlaylists = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const parsed = raw ? JSON.parse(raw) : [];
      const list: UserPlaylist[] = Array.isArray(parsed) ? parsed : [];
      list.sort(
        (a, b) =>
          (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
      );
      if (mounted.current) setUserPlaylists(list);
    } catch (e) {
      console.warn("[Library] load playlists failed:", e);
      if (mounted.current) setUserPlaylists([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserPlaylists();
      loadPinnedSongs();
    }, [loadUserPlaylists]),
  );

  useEffect(() => {
    if (songs.length > 0) {
      setScanning(false);
      return;
    }
    if (scanStarted.current) return;
    scanStarted.current = true;
    setScanning(true);
    Promise.resolve(scanAll?.())
      .catch((e: any) => console.error("[Library] scan failed:", e))
      .finally(() => {
        if (mounted.current) setScanning(false);
      });
  }, [songs.length]);

  useEffect(() => {
    if (songs.length === 0) {
      setTagsReady(false);
      setArtReady(false);
      return;
    }

    const tagCount = Object.keys(tagData || {}).length;
    const artCount = Object.keys(artworkMap || {}).length;

    if (!tagsReady && tagCount > 0) setTagsReady(true);
    if (!artReady && artCount > 0) setArtReady(true);

    const t = setTimeout(() => {
      setTagsReady(true);
      setArtReady(true);
    }, TAG_WAIT_MS);
    return () => clearTimeout(t);
  }, [songs, tagData, artworkMap, tagsReady, artReady]);

  const [bootMinDone, setBootMinDone] = useState(false);
  useEffect(() => {
    if (MIN_LOADER_VISIBLE_MS <= 0) {
      setBootMinDone(true);
      return;
    }
    const t = setTimeout(() => setBootMinDone(true), MIN_LOADER_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  const navigateTo = useCallback(
    (name: string): boolean => {
      let n: any = nav;
      while (n) {
        const names: string[] | undefined = n.getState?.()?.routeNames;
        if (names && names.includes(name)) {
          n.navigate(name);
          return true;
        }
        n = n.getParent?.();
      }
      console.log(`[Library] screen "${name}" is not registered`);
      showToast(`"${name}" screen is not registered in the navigator`);
      return false;
    },
    [nav],
  );

  const loadSavedLibraryConfig = async () => {
    try {
      const savedOrderRaw = await AsyncStorage.getItem(STORAGE_LIBRARY_ORDER);
      const savedVisibleRaw = await AsyncStorage.getItem(
        STORAGE_LIBRARY_VISIBLE,
      );

      if (savedVisibleRaw) {
        setVisibleMap({ ...INITIAL_VISIBLE, ...JSON.parse(savedVisibleRaw) });
      }

      if (!savedOrderRaw) return;

      const savedOrder: string[] = JSON.parse(savedOrderRaw);

      const reordered: any[] = [];
      savedOrder.forEach((id) => {
        const found = DEFAULT_ITEMS.find((it) => it.id === id);
        if (found && !reordered.some((r) => r.id === id)) {
          reordered.push(found);
        }
      });

      DEFAULT_ITEMS.forEach((it, defaultIdx) => {
        if (reordered.some((r) => r.id === it.id)) return;

        let insertAfterId: string | null = null;
        for (let i = defaultIdx - 1; i >= 0; i--) {
          const prevId = DEFAULT_ITEMS[i].id;
          if (reordered.some((r) => r.id === prevId)) {
            insertAfterId = prevId;
            break;
          }
        }

        if (insertAfterId) {
          const pos = reordered.findIndex((r) => r.id === insertAfterId);
          reordered.splice(pos + 1, 0, it);
          return;
        }

        let insertBeforeId: string | null = null;
        for (let i = defaultIdx + 1; i < DEFAULT_ITEMS.length; i++) {
          const nextId = DEFAULT_ITEMS[i].id;
          if (reordered.some((r) => r.id === nextId)) {
            insertBeforeId = nextId;
            break;
          }
        }

        if (insertBeforeId) {
          const pos = reordered.findIndex((r) => r.id === insertBeforeId);
          reordered.splice(pos, 0, it);
          return;
        }

        reordered.push(it);
      });

      setItems(reordered);
    } catch (e: any) {
      console.log("Load library config error:", e.message);
    }
  };

  const saveLibraryConfig = async () => {
    try {
      const order = items.map((it) => it.id);
      await AsyncStorage.setItem(STORAGE_LIBRARY_ORDER, JSON.stringify(order));
      await AsyncStorage.setItem(
        STORAGE_LIBRARY_VISIBLE,
        JSON.stringify(visibleMap),
      );
    } catch (e: any) {
      console.log("Save library config error:", e.message);
    }
  };

  const handleEditPress = () => setIsEditing(true);

  const handleDonePress = async () => {
    await saveLibraryConfig();
    setIsEditing(false);
  };

  const toggleEditMode = useCallback(() => {
    if (isEditingPins) setIsEditingPins(false);
    if (isEditing) {
      handleDonePress();
    } else {
      handleEditPress();
    }
  }, [isEditing, isEditingPins, handleDonePress]);

  const enterEditPins = useCallback(() => {
    if (isEditing) setIsEditing(false);
    setEditPinnedSongIds({ ...pinnedSongIds });
    const plMap: Record<string, boolean> = {};
    userPlaylists
      .filter((p) => p.pinned)
      .forEach((p) => {
        plMap[p.id] = true;
      });
    setEditPinnedPlaylistIds(plMap);
    setIsEditingPins(true);
  }, [isEditing, pinnedSongIds, userPlaylists]);

  const removePinnedSongInEdit = useCallback((song: any) => {
    const id = song.id || song._id;
    if (!id) return;
    setEditPinnedSongIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const removePinnedPlaylistInEdit = useCallback((pl: any) => {
    if (!pl?.id) return;
    setEditPinnedPlaylistIds((prev) => {
      const next = { ...prev };
      delete next[pl.id];
      return next;
    });
  }, []);

  const savePins = useCallback(async () => {
    try {
      const validSongIds: Record<string, boolean> = {};
      Object.keys(editPinnedSongIds).forEach((id) => {
        if (songs.some((s: any) => (s.id || s._id) === id)) {
          validSongIds[id] = true;
        }
      });

      setPinnedSongIds(validSongIds);
      await AsyncStorage.setItem(
        STORAGE_PINNED_SONGS,
        JSON.stringify(validSongIds),
      );

      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      if (raw) {
        const pls = JSON.parse(raw);
        if (Array.isArray(pls)) {
          const updated = pls.map((pl: any) => ({
            ...pl,
            pinned: !!editPinnedPlaylistIds[pl.id],
          }));
          await AsyncStorage.setItem(
            STORAGE_PLAYLISTS,
            JSON.stringify(updated),
          );
          await loadUserPlaylists();
        }
      }

      showToast("Pins updated");
    } catch (e) {
      console.warn("[Library] save pins failed:", e);
      showToast("Could not save pins");
    } finally {
      setIsEditingPins(false);
    }
  }, [
    editPinnedSongIds,
    editPinnedPlaylistIds,
    songs,
    loadUserPlaylists,
  ]);

  const toggleVisible = (id: string) => {
    setVisibleMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onDragEnd = ({ data }: any) => setItems(data);

  const visibleItems = items.filter((it) => visibleMap[it.id] !== false);

  const handlePickImage = () => {
    setImageMenuOpen(true);
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
        setCoverImage(res.assets[0].uri);
      }
    } catch (e) {
      console.warn("[Library] camera error:", e);
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
        setCoverImage(res.assets[0].uri);
      }
    } catch (e) {
      console.warn("[Library] library error:", e);
      showToast("Could not open photos");
    }
  };

  const handleRemoveCover = () => {
    setImageMenuOpen(false);
    setCoverImage(null);
  };

  const handleCreatePlaylist = async () => {
    if (!playlistTitle.trim()) {
      Alert.alert("Error", "Please enter playlist title");
      return;
    }

    setCreating(true);

    try {
      const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
      const existing = raw ? JSON.parse(raw) : [];

      const savedArtwork = coverImage ? await persistArtwork(coverImage) : null;

      const newPlaylist = {
        id: `pl_${Date.now()}`,
        name: playlistTitle.trim(),
        producer: "You",
        description: "",
        isFeatured: false,
        artwork: savedArtwork,
        songs: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updated = [newPlaylist, ...existing];
      await AsyncStorage.setItem(STORAGE_PLAYLISTS, JSON.stringify(updated));

      await loadUserPlaylists();

      setPlaylistTitle("");
      setCoverImage(null);
      setShowCreatePlaylist(false);

      showToast("Playlist created successfully");
      navigateTo(ROUTE_MAP.playlists);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const renderIcon = (item: any) => {
    if (item.type === "emoji") {
      return <Text style={{ fontSize: 20 }}>{item.emoji}</Text>;
    }
    if (item.type === "star") {
      return (
        <StarFillIcon
          color={item.tint ?? COLORS.primary}
          size={item.size ?? 18}
        />
      );
    }
    if (item.type === "albumsvg") {
      return (
        <AlbumsSvgIcon
          color={item.tint ?? COLORS.primary}
          size={item.size ?? 24}
        />
      );
    }
    if (item.type === "artists") {
      const size = item.size ?? 26;
      return (
        <Svg width={size} height={size} viewBox="3.5 4 17 16" fill="none">
          <Path
            fill={COLORS.primary}
            d="M18.39 9.42c1.289-1.282 1.34-2.908.102-4.139-1.23-1.216-2.85-1.186-4.138.103zm-6.08 9.858a.66.66 0 0 0 .667-.667v-4.328l-.051-1.048 2.234-2.072c.842.11 1.728-.235 2.49-1.004l-4.03-4.035c-.776.761-1.098 1.633-.988 2.475l-6.805 7.332c-.278.3-.322.717.022 1.062L4.913 18.2a.31.31 0 0 0 .037.418l.212.22a.31.31 0 0 0 .425.029l1.208-.945c.33.344.755.3 1.048.022l3.8-3.516v4.182a.66.66 0 0 0 .667.667zm-5.053-2.073-.674-.674 6.453-6.84q.186.307.461.593.274.276.571.476z"
          />
        </Svg>
      );
    }
    if (item.type === "png" || item.type === "song") {
      const tint = item.tint ?? COLORS.primary;
      const size = item.size ?? 22;
      return (
        <Image
          source={item.source}
          style={{ width: size, height: size, tintColor: tint }}
          resizeMode="contain"
          fadeDuration={0}
        />
      );
    }
    return <Text style={{ fontSize: 18 }}>📁</Text>;
  };

  const renderEditRow = ({ item, drag, isActive }: any) => {
    const checked = visibleMap[item.id] !== false;

    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={drag}
          disabled={isActive}
          style={[styles.editRow, isActive && styles.editRowActive]}
        >
          <TouchableOpacity
            onPress={() => toggleVisible(item.id)}
            style={styles.checkboxTouch}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>

          <View style={styles.iconWrapper}>{renderIcon(item)}</View>

          <Text style={styles.rowLabel}>{item.label}</Text>

          <View style={styles.dragHandle}>
            <View style={styles.dragLine} />
            <View style={styles.dragLine} />
            <View style={styles.dragLine} />
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const renderNormalRow = (item: any, index: number) => (
    <View key={item.id}>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => {
          const target = ROUTE_MAP[item.id];
          if (target) navigateTo(target);
        }}
      >
        <View style={styles.iconWrapper}>{renderIcon(item)}</View>
        <Text style={styles.rowLabel}>{item.label}</Text>
      </TouchableOpacity>

      {index < visibleItems.length - 1 && <View style={styles.divider} />}
    </View>
  );

  const pinnedPlaylists = useMemo(
    () => userPlaylists.filter((p) => p.pinned),
    [userPlaylists],
  );

  const pinnedSongs = useMemo(() => {
    return songs.filter((s: any) => pinnedSongIds[s.id || s._id]);
  }, [songs, pinnedSongIds]);

  const displayPinnedSongs = useMemo(() => {
    if (!isEditingPins) return pinnedSongs;
    return songs.filter((s: any) => editPinnedSongIds[s.id || s._id]);
  }, [isEditingPins, pinnedSongs, songs, editPinnedSongIds]);

  const displayPinnedPlaylists = useMemo(() => {
    if (!isEditingPins) return pinnedPlaylists;
    return userPlaylists.filter((p) => editPinnedPlaylistIds[p.id]);
  }, [isEditingPins, pinnedPlaylists, userPlaylists, editPinnedPlaylistIds]);

  const navigateToAlbum = useCallback(
    (song: any) => {
      const albumName = String(song?.album ?? "").trim();
      if (!albumName) {
        showToast("Album info unavailable");
        return;
      }

      const sameAlbum = songs.filter(
        (s: any) =>
          String(s?.album || "")
            .trim()
            .toLowerCase() === albumName.toLowerCase(),
      );
      const songIds = sameAlbum.map((s: any) => s.id).filter(Boolean);

      nav.navigate("AlbumDetails", {
        albumName,
        songIds,
        artwork:
          (song as any).artwork ??
          (song as any).artworkUri ??
          artworkMap[song.id],
      });
    },
    [songs, artworkMap, nav],
  );

  const renderPinnedSection = () => {
    const songList = displayPinnedSongs;
    const playlistList = displayPinnedPlaylists;
    const isEmpty = songList.length === 0 && playlistList.length === 0;

    if (isEmpty && !isEditingPins) return null;

    return (
      <View style={styles.pinnedSection}>
        {isEditingPins && (
          <View style={styles.editPinsBar}>
            <Text style={styles.editModeLabel}>Edit Pins</Text>
            <TouchableOpacity
              onPress={savePins}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Text style={styles.editPinsSave}>✓</Text>
            </TouchableOpacity>
          </View>
        )}

        {isEmpty ? (
          <Text style={styles.noPinsText}>No pinned items yet.</Text>
        ) : (
          <View style={styles.pinnedGrid}>
            {songList.map((s: any) => {
              const sid = s.id || s._id;
              const art =
                (s as any).artwork ??
                (s as any).artworkUri ??
                artworkMap[sid];

              return (
                <TouchableOpacity
                  key={`pinned_song_${sid}`}
                  activeOpacity={isEditingPins ? 1 : 0.75}
                  style={styles.pinnedCard}
                  onPress={() => {
                    if (isEditingPins) return;
                    navigateToAlbum(s);
                  }}
                  onLongPress={
                    isEditingPins
                      ? undefined
                      : () => {
                          setContextSong({ ...s, artwork: art });
                          setSheetVisible(true);
                        }
                  }
                  delayLongPress={350}
                >
                  <View style={styles.pinnedArt}>
                    {art ? (
                      <Image
                        source={{ uri: art }}
                        style={styles.pinnedArtImg}
                        resizeMode="cover"
                        fadeDuration={0}
                      />
                    ) : (
                      <View style={styles.pinnedFallbackArt}>
                        <DefaultSongArt style={styles.pinnedArtImg} />
                      </View>
                    )}

                    {isEditingPins && (
                      <TouchableOpacity
                        style={styles.minusBadge}
                        onPress={() => removePinnedSongInEdit(s)}
                        hitSlop={10}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.minusBadgeText}>−</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.pinnedName} numberOfLines={1}>
                    {s.title || "Unknown"}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {playlistList.map((pl) => (
              <TouchableOpacity
                key={`pinned_${pl.id}`}
                activeOpacity={isEditingPins ? 1 : 0.75}
                style={styles.pinnedCard}
                onPress={() => {
                  if (isEditingPins) return;
                  nav.navigate("PlaylistDetails", { playlistId: pl.id });
                }}
              >
                <View style={styles.pinnedArt}>
                  {pl.artwork ? (
                    <Image
                      source={{ uri: pl.artwork }}
                      style={styles.pinnedArtImg}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                  ) : (
                    <View style={styles.pinnedFallbackArt}>
                      <UserPlaylistIcon size={70} color={COLORS.inactive} />
                    </View>
                  )}

                  {isEditingPins && (
                    <TouchableOpacity
                      style={styles.minusBadge}
                      onPress={() => removePinnedPlaylistInEdit(pl)}
                      hitSlop={10}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.minusBadgeText}>−</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.pinnedName} numberOfLines={1}>
                  {pl.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const playlistPreview = useMemo(
    () => userPlaylists.slice(0, PLAYLIST_PREVIEW_LIMIT),
    [userPlaylists],
  );

  const mergedGrid = useMemo<MergedItem[]>(() => {
    const items: MergedItem[] = [];

    songs.forEach((song: any) => {
      const id = song.id || song._id;
      items.push({
        kind: "song",
        key: `song_${id}`,
        ts: getSongTimestamp(song),
        song,
      });
    });

    playlistPreview.forEach((pl) => {
      items.push({
        kind: "playlist",
        key: `pl_${pl.id}`,
        ts: pl.updatedAt ?? pl.createdAt ?? 0,
        playlist: pl,
      });
    });

    items.sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return a.key.localeCompare(b.key);
    });

    const pinned = items.filter(
      (it) => it.kind === "playlist" && (it as any).playlist.pinned,
    );
    const rest = items.filter(
      (it) => !(it.kind === "playlist" && (it as any).playlist.pinned),
    );
    const sorted = [...pinned, ...rest];

    sorted.push({ kind: "fav", key: "fav_songs", ts: -1 });

    return sorted;
  }, [songs, playlistPreview]);

  const handlePinToggle = useCallback(async () => {
    if (!contextSong) return;
    const id = contextSong.id || contextSong._id;
    if (!id) return;
    const next = { ...pinnedSongIds };
    if (next[id]) delete next[id];
    else next[id] = true;
    setPinnedSongIds(next);
    try {
      await AsyncStorage.setItem(STORAGE_PINNED_SONGS, JSON.stringify(next));
      showToast(next[id] ? "Pinned to Library" : "Unpinned");
    } catch (e) {
      console.warn("[Library] save pinned failed:", e);
    }
    setSheetVisible(false);
    setContextSong(null);
  }, [contextSong, pinnedSongIds]);

  const handleFavouriteToggle = useCallback(() => {
    if (!contextSong) return;
    const id = contextSong.id || contextSong._id;
    if (!id) return;
    const store = useMediaStore.getState() as any;
    const fav: Record<string, boolean> = { ...(store.favoritesSong || {}) };
    const wasFav = !!fav[id];
    if (wasFav) delete fav[id];
    else fav[id] = true;
    useMediaStore.setState({ favoritesSong: fav });
    showToast(wasFav ? "Removed from Favourites" : "Added to Favourites");
    setSheetVisible(false);
    setContextSong(null);
  }, [contextSong]);

  const handlePlayNext = useCallback(() => {
    if (!contextSong) return;
    try {
      const st: any = usePlayerStore.getState();
      if (typeof st?.playNext === "function") {
        st.playNext(contextSong);
        showToast("Will play next");
      } else if (typeof (audio as any).playNext === "function") {
        (audio as any).playNext(contextSong);
        showToast("Will play next");
      } else {
        showToast("Queue not available");
      }
    } catch {
      showToast("Could not queue song");
    }
    setSheetVisible(false);
    setContextSong(null);
  }, [contextSong, audio]);

  const handleDeleteSong = useCallback(async () => {
    if (!contextSong || deleting) return;
    const id = contextSong.id || contextSong._id;
    const uri = contextSong.uri || contextSong.path;
    if (!id) {
      setDeleteConfirmVisible(false);
      setSheetVisible(false);
      setContextSong(null);
      return;
    }

    setDeleting(true);
    try {
      const playingId =
        currentSong?.id || currentSong?._id || (audio as any).currentId;
      if (playingId === id) {
        try {
          audio.stop?.();
          audio.pause?.();
        } catch {}
      }

          // 🔥 FIX: Instantly update PlayerStore and stop audio
         // 🔥 FIX: Instantly update PlayerStore and stop native background audio
           // 🔥 FIX: Instantly update PlayerStore and stop native background audio
      try {
        const ps: any = usePlayerStore.getState();
        if (ps?.currentTrack && String(ps.currentTrack.id) === String(id)) {
          
          // Force native TrackPlayer to stop and clear the queue
          try {
            await TrackPlayer.reset(); 
          } catch (e) {
            console.log("TrackPlayer reset error:", e);
          }

          // Fallback to hook methods
          try { await audio?.stop?.(); } catch (e) {}
          
          // Clear React Store
          if (typeof ps.setCurrentTrack === "function") ps.setCurrentTrack(null);
          if (typeof ps.setIsPlaying === "function") ps.setIsPlaying(false);
          if (typeof ps.clearQueue === "function") ps.clearQueue();
        } else if (Array.isArray(ps.queue)) {
          const newQueue = ps.queue.filter((s: any) => String(s.id) !== String(id));
          if (typeof ps.setQueue === "function") ps.setQueue(newQueue);
        }
      } catch (e) {
        console.warn("[LibraryScreen] Failed to reset player:", e);
      }

      const store = useMediaStore.getState() as any;
      const nextSongs = (store.songs || []).filter(
        (s: any) => (s.id || s._id) !== id,
      );
      const nextFav = { ...(store.favoritesSong || {}) };
      delete nextFav[id];
      useMediaStore.setState({
        songs: nextSongs,
        favoritesSong: nextFav,
      });

      try {
        const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
        if (raw) {
          const pls = JSON.parse(raw);
          if (Array.isArray(pls)) {
            const updated = pls.map((pl: any) => ({
              ...pl,
              songs: Array.isArray(pl.songs)
                ? pl.songs.filter((s: any) => (s.id || s._id) !== id)
                : pl.songs,
            }));
            await AsyncStorage.setItem(
              STORAGE_PLAYLISTS,
              JSON.stringify(updated),
            );
            await loadUserPlaylists();
          }
        }
      } catch (e) {
        console.warn("[Library] playlist cleanup failed:", e);
      }

      if (pinnedSongIds[id]) {
        const next = { ...pinnedSongIds };
        delete next[id];
        setPinnedSongIds(next);
        try {
          await AsyncStorage.setItem(
            STORAGE_PINNED_SONGS,
            JSON.stringify(next),
          );
        } catch {}
      }

      showToast("Song deleted");
    } catch (e) {
      console.warn("[Library] delete error:", e);
      showToast("Could not delete song");
    } finally {
      setDeleting(false);
      setDeleteConfirmVisible(false);
      setSheetVisible(false);
      setContextSong(null);
    }
  }, [
    contextSong,
    deleting,
    currentSong,
    audio,
    loadUserPlaylists,
    pinnedSongIds,
  ]);

  const renderGridItem = (entry: MergedItem, cardWidth: number) => {
    if (entry.kind === "fav") {
      return (
        <TouchableOpacity
          key={entry.key}
          activeOpacity={0.85}
          style={[styles.gridCard, { width: cardWidth }]}
          onPress={() => navigateTo("FavouriteSongs")}
        >
          <View
            style={[
              styles.gridArt,
              {
                width: cardWidth,
                height: cardWidth,
                backgroundColor: COLORS.surface,
                borderColor: "transparent",
              },
            ]}
          >
            <Image
              source={FAVOURITE_HERO}
              style={styles.gridArtImg}
              resizeMode="cover"
              fadeDuration={0}
            />
          </View>

          <View style={styles.favBottomRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.gridTitle,
                { color: COLORS.text, flex: 1, marginTop: 0 },
              ]}
            >
              Favourite Songs
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (entry.kind === "playlist") {
      const pl = entry.playlist;
      return (
        <TouchableOpacity
          key={entry.key}
          activeOpacity={0.75}
          style={[styles.gridCard, { width: cardWidth }]}
          onPress={() => nav.navigate("PlaylistDetails", { playlistId: pl.id })}
        >
          <View
            style={[
              styles.gridArt,
              {
                width: cardWidth,
                height: cardWidth,
                backgroundColor: COLORS.surface,
                borderColor: "transparent",
              },
            ]}
          >
            {pl.artwork ? (
              <Image
                source={{ uri: pl.artwork }}
                style={styles.gridArtImg}
                resizeMode="cover"
                fadeDuration={0}
              />
            ) : (
              <View style={styles.playlistFallbackArt}>
                <UserPlaylistIcon
                  size={Math.round(cardWidth * 0.7)}
                  color={COLORS.inactive}
                />
              </View>
            )}
          </View>

          <Text
            numberOfLines={1}
            style={[styles.gridTitle, { color: COLORS.text }]}
          >
            {pl.name}
          </Text>
        </TouchableOpacity>
      );
    }

    const song = entry.song;
    const songId = song.id || song._id;
    const isCurrent = currentSong?.id === songId;
    const artwork =
      (song as any).artwork ??
      (song as any).artworkUri ??
      artworkMap[songId];

    const taggedArtist = tagData[songId]?.artist;
    const artist =
      !isUnknownArtist(song.artist) && song.artist
        ? song.artist
        : taggedArtist || UNKNOWN_ARTIST;

    return (
      <TouchableOpacity
        key={entry.key}
        activeOpacity={0.75}
        style={[styles.gridCard, { width: cardWidth }]}
        onPress={() => navigateToAlbum(song)}
        onLongPress={() => {
          setContextSong({ ...song, artwork });
          setSheetVisible(true);
        }}
        delayLongPress={350}
      >
        <View
          style={[
            styles.gridArt,
            {
              width: cardWidth,
              height: cardWidth,
              backgroundColor: COLORS.surface,
              borderColor: isCurrent ? COLORS.primary : "transparent",
            },
          ]}
        >
          {artwork ? (
            <Image
              source={{ uri: artwork }}
              style={styles.gridArtImg}
              resizeMode="cover"
              fadeDuration={0}
            />
          ) : (
            <DefaultSongArt style={styles.gridArtImg} />
          )}

          {isCurrent && (
            <View
              style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                ▶
              </Text>
            </View>
          )}
        </View>

        <Text
          numberOfLines={1}
          style={[
            styles.gridTitle,
            { color: isCurrent ? COLORS.primary : COLORS.text },
          ]}
        >
          {song.title || "Unknown"}
        </Text>

        <Text
          numberOfLines={1}
          style={[styles.gridSub, { color: COLORS.textSecondary }]}
        >
          {artist}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderRecentlyAdded = () => {
    if (mergedGrid.length === 0) return null;

    const cols = 2;
    const gap = 12;
    const cardWidth =
      (SCREEN_W - CONTENT_H_PADDING * 2 - 8 - gap * (cols - 1)) / cols;

    return (
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recently Added</Text>
        </View>

        <View style={styles.gridWrap}>
          {mergedGrid.map((entry) => renderGridItem(entry, cardWidth))}
        </View>
      </View>
    );
  };

  const showLoading = !bootMinDone || (songs.length === 0 && scanning);

  const contextSongId = contextSong?.id || contextSong?._id;
  const isPinned = !!(contextSongId && pinnedSongIds[contextSongId]);
  const isFav = !!(contextSongId && favorites[contextSongId]);
  const contextArtwork =
    (contextSong as any)?.artwork ??
    (contextSong as any)?.artworkUri ??
    (contextSongId ? artworkMap[contextSongId] : undefined);

  return (
    <View style={styles.container}>
      <Header
        title="Library"
        scrollY={scrollY}
        onPlusPress={() => setShowCreatePlaylist(true)}
        fontFamily="sans-serif"
        onEditCategories={toggleEditMode}
        onEditPins={enterEditPins}
      />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: HEADER_SPACER + insets.top },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isEditing && !showLoading && !isEditingPins}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ opacity: showLoading ? 0 : 1 }}
        pointerEvents={showLoading ? "none" : "auto"}
      >
        {!isEditing && renderPinnedSection()}

        {isEditing ? (
          <View style={styles.editListWrapper}>
            <View style={styles.editDoneRow}>
              <Text style={styles.editModeLabel}>Edit Categories</Text>
              <TouchableOpacity
                onPress={handleDonePress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.editBtn}>Done</Text>
              </TouchableOpacity>
            </View>

            <DraggableFlatList
              data={items}
              keyExtractor={(item: any) => item.id}
              renderItem={renderEditRow}
              onDragEnd={onDragEnd}
              scrollEnabled={false}
              activationDistance={5}
            />
          </View>
        ) : isEditingPins ? (
          null
        ) : (
          <View style={styles.list}>
            {visibleItems.map((item, index) => renderNormalRow(item, index))}
            <View style={styles.listEndDivider} />
          </View>
        )}

        {!isEditing && !isEditingPins && renderRecentlyAdded()}

        <View style={{ height: 180 }} />
      </Animated.ScrollView>

      {showLoading && (
        <View pointerEvents="none" style={styles.loaderOverlay}>
          <View style={styles.loaderBox}>
            <HorizontalLoader />
          </View>
        </View>
      )}

      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSheetVisible(false);
          setContextSong(null);
        }}
      >
        <View style={styles.sheetRoot}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => {
              setSheetVisible(false);
              setContextSong(null);
            }}
          />
          <View style={styles.songSheet}>
            <View style={styles.sheetHandle} />

            {contextSong && (
              <>
                <View style={styles.songHeader}>
                  <Image
                    source={
                      contextArtwork
                        ? { uri: contextArtwork }
                        : MUSIC_DEFAULT_PNG
                    }
                    style={styles.songHeaderArt}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                  <View style={styles.songHeaderText}>
                    <Text numberOfLines={1} style={styles.songHeaderTitle}>
                      {contextSong.title || "Unknown"}
                    </Text>
                    <Text numberOfLines={1} style={styles.songHeaderArtist}>
                      {!isUnknownArtist(contextSong.artist)
                        ? contextSong.artist
                        : UNKNOWN_ARTIST}
                    </Text>
                  </View>
                </View>

                <View style={styles.sheetDivider} />

                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={handlePlayNext}
                >
                  <Text style={styles.sheetRowText}>Play next</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={handleFavouriteToggle}
                >
                  <Text style={styles.sheetRowText}>
                    {isFav ? "Undo favourite" : "Favourite"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={handlePinToggle}
                >
                  <Text style={styles.sheetRowText}>
                    {isPinned ? "Unpin Album" : "Pin Album"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sheetRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSheetVisible(false);
                    setDeleteConfirmVisible(true);
                  }}
                >
                  <Text style={[styles.sheetRowText, { color: "#E53935" }]}>
                    Delete Song
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete Song</Text>
            <Text style={styles.confirmBody}>
              Are you sure you want to delete this album from your library?
              This also removes songs from your favourites and from any
              playlist you made.
            </Text>

            <TouchableOpacity
              style={styles.confirmDeleteBtn}
              activeOpacity={0.85}
              onPress={handleDeleteSong}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmDeleteText}>
                  Delete FROM Library
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmCancelBtn}
              activeOpacity={0.85}
              onPress={() => {
                setDeleteConfirmVisible(false);
                setContextSong(null);
              }}
              disabled={deleting}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreatePlaylist}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreatePlaylist(false)}
      >
        <Pressable
          style={styles.createBackdrop}
          onPress={() => setShowCreatePlaylist(false)}
        >
          <Pressable
            style={styles.createSheet}
            onPress={(e: any) => e.stopPropagation()}
          >
            <View style={styles.createTopBar}>
              <TouchableOpacity
                onPress={() => setShowCreatePlaylist(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.crossIcon}>✕</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreatePlaylist}
                disabled={creating}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {creating ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <Text style={styles.checkIcon}>✓</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handlePickImage}
              style={styles.coverUpload}
              activeOpacity={0.8}
            >
              {coverImage ? (
                <Image source={{ uri: coverImage }} style={styles.coverImage} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.coverPlus}>+</Text>
                  <Text style={styles.coverHint}>Choose Image</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={playlistTitle}
              onChangeText={setPlaylistTitle}
              placeholder="Playlist Title"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              maxLength={50}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={imageMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setImageMenuOpen(false)}
      >
        <View style={styles.imageModalRoot}>
          <TouchableOpacity
            style={styles.imageBackdrop}
            activeOpacity={1}
            onPress={() => setImageMenuOpen(false)}
          />
          <View style={styles.imageSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.imageSheetTitle}>Playlist cover</Text>

            <TouchableOpacity
              style={styles.imageOption}
              onPress={handleTakePhoto}
            >
              <Text style={styles.imageOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imageOption}
              onPress={handleChooseFromLibrary}
            >
              <Text style={styles.imageOptionText}>Your Photos</Text>
            </TouchableOpacity>

            {coverImage ? (
              <TouchableOpacity
                style={styles.imageOption}
                onPress={handleRemoveCover}
              >
                <Text style={[styles.imageOptionText, { color: "#E53935" }]}>
                  ⌫ Remove image
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.imageCancel}
              onPress={() => setImageMenuOpen(false)}
            >
              <Text style={styles.imageCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 👇 Added TopStatusGlass overlay for the edge-to-edge fade */}
      <TopStatusGlass />
    </View>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    content: {
      paddingTop: HEADER_SPACER,
      paddingHorizontal: CONTENT_H_PADDING,
    },

    editBtn: {
      color: COLORS.primary,
      fontSize: 17,
      fontWeight: "600",
      fontFamily: FONT,
    },

    loaderOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    loaderBox: {
      width: 220,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.55)",
    },

    pinnedSection: {
      marginTop: 0,
      marginBottom: 4,
    },
    editPinsBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      marginBottom: 10,
    },
    editPinsSave: {
      color: COLORS.primary,
      fontSize: 24,
      fontWeight: "900",
      fontFamily: FONT,
      lineHeight: 26,
    },
    noPinsText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontFamily: FONT,
      paddingVertical: 14,
      textAlign: "center",
    },
    pinnedGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    pinnedCard: { width: 84 },
    pinnedArt: {
      width: 90,
      height: 90,
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: COLORS.surface,
      borderWidth: 0.5,
      borderColor: "#ddd8d866",
      alignItems: "center",
      justifyContent: "center",
    },
    pinnedArtImg: { width: "100%", height: "100%" },
    pinnedFallbackArt: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.surfaceLight,
    },
    pinnedName: {
      marginTop: 6,
      color: COLORS.text,
      fontSize: 13,
      fontWeight: "500",
      fontFamily: FONT,
      textAlign: "center",
    },
    pinnedSongPin: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: COLORS.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    pinnedSongPinText: { color: "#fff", fontSize: 10, fontWeight: "700" },

    minusBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#E53935",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "#ffffff",
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 3,
    },
    minusBadgeText: {
      color: "#ffffff",
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 22,
      marginTop: -2,
      fontFamily: FONT,
    },

    list: { marginTop: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 2,
      paddingHorizontal: 0,
      minHeight: 35,
    },
    iconWrapper: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
      backgroundColor: "transparent",
      borderWidth: 0,
    },

    listEndDivider: {
      height: DIVIDER_HEIGHT,
      backgroundColor: COLORS.divider ?? COLORS.border,
      opacity: 1,
      marginLeft: 62,
      marginBottom: 8,
    },

    rowLabel: {
      flex: 1,
      color: COLORS.text,
      fontSize: 21.5,
      fontWeight: "400",
      fontFamily: FONT,
    },

    divider: {
      height: DIVIDER_HEIGHT,
      backgroundColor: COLORS.divider ?? COLORS.border,
      marginLeft: 62,
      opacity: 1,
    },

    editListWrapper: { marginTop: 8 },
    editDoneRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      marginBottom: 6,
    },
    editModeLabel: {
      color: COLORS.textSecondary,
      fontSize: 15,
      fontWeight: "600",
      fontFamily: FONT,
    },

    editRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 0,
      minHeight: 56,
      backgroundColor: COLORS.background,
    },
    editRowActive: { backgroundColor: COLORS.surfaceLight, borderRadius: 8 },
    checkboxTouch: { padding: 4, marginRight: 6 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: COLORS.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "transparent",
    },
    checkboxChecked: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    checkmark: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 16,
    },
    dragHandle: {
      width: 30,
      height: 22,
      justifyContent: "center",
      alignItems: "center",
      gap: 3,
    },
    dragLine: {
      width: 18,
      height: 2,
      borderRadius: 1,
      backgroundColor: COLORS.textMuted,
    },

    recentSection: { marginTop: 24, marginBottom: 24 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 0,
      marginBottom: 12,
    },
    sectionTitle: {
      color: COLORS.text,
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      fontFamily: FONT,
    },

    gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    gridCard: { marginBottom: 8 },
    gridArt: {
      borderRadius: 12,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    gridArtImg: { width: "100%", height: "100%" },
    gridTitle: {
      fontSize: 15,
      fontWeight: "500",
      marginTop: 5,
      fontFamily: FONT,
    },
    gridSub: { fontSize: 12, marginTop: 2, fontFamily: FONT },

    playlistFallbackArt: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.surfaceLight,
    },

    favBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },

    sheetRoot: { flex: 1, justifyContent: "flex-end" },
    sheetBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    songSheet: {
      backgroundColor: COLORS.surface,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
    },
    songHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 14,
    },
    songHeaderArt: {
      width: 56,
      height: 56,
      borderRadius: 10,
      backgroundColor: COLORS.surfaceLight,
    },
    songHeaderText: { flex: 1 },
    songHeaderTitle: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: "700",
      fontFamily: FONT,
    },
    songHeaderArtist: {
      color: COLORS.textSecondary,
      fontSize: 13,
      marginTop: 3,
      fontFamily: FONT,
    },
    sheetDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.border,
      marginVertical: 8,
    },
    sheetRow: { paddingVertical: 14, paddingHorizontal: 4 },
    sheetRowText: { color: COLORS.text, fontSize: 16, fontFamily: FONT },

    confirmBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    confirmCard: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: COLORS.surface,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
    },
    confirmTitle: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 10,
      fontFamily: FONT,
    },
    confirmBody: {
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 18,
      fontFamily: FONT,
    },
    confirmDeleteBtn: {
      backgroundColor: "#E53935",
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmDeleteText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
      fontFamily: FONT,
    },
    confirmCancelBtn: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmCancelText: {
      color: COLORS.textSecondary,
      fontSize: 15,
      fontFamily: FONT,
    },

    createBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: SPACING.lg,
    },
    createSheet: {
      backgroundColor: COLORS.surface,
      borderRadius: 20,
      paddingHorizontal: SPACING.lg,
      paddingTop: 20,
      paddingBottom: 24,
      width: "100%",
      maxWidth: 380,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 16,
    },
    createTopBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    crossIcon: {
      color: COLORS.text,
      fontSize: 24,
      fontWeight: "400",
      fontFamily: FONT,
    },
    checkIcon: {
      color: COLORS.primary,
      fontSize: 26,
      fontWeight: "700",
      fontFamily: FONT,
    },
    coverUpload: { alignSelf: "center", marginBottom: 20 },
    coverImage: {
      width: 150,
      height: 150,
      borderRadius: 16,
      backgroundColor: COLORS.card,
    },
    coverPlaceholder: {
      width: 150,
      height: 150,
      borderRadius: 16,
      backgroundColor: COLORS.surfaceLight,
      borderWidth: 2,
      borderColor: COLORS.border,
      borderStyle: "dashed",
      justifyContent: "center",
      alignItems: "center",
    },
    coverPlus: {
      color: COLORS.textMuted,
      fontSize: 40,
      fontWeight: "300",
      fontFamily: FONT,
    },
    coverHint: {
      color: COLORS.textMuted,
      fontSize: 12,
      marginTop: 6,
      fontFamily: FONT,
    },
    input: {
      backgroundColor: COLORS.surfaceLight,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: 14,
      color: COLORS.text,
      fontSize: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      textAlign: "center",
      fontFamily: FONT,
    },

    sheetHandle: {
      width: 42,
      height: 5,
      borderRadius: 4,
      backgroundColor: COLORS.textMuted,
      alignSelf: "center",
      marginBottom: 14,
    },

    imageModalRoot: { flex: 1, justifyContent: "flex-end" },
    imageBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    imageSheet: {
      backgroundColor: COLORS.surface,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 28,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
    },
    imageSheetTitle: {
      color: COLORS.text,
      fontSize: 17,
      fontWeight: "600",
      marginBottom: 12,
      fontFamily: FONT,
    },
    imageOption: {
      minHeight: 52,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    imageOptionText: { color: COLORS.text, fontSize: 16, fontFamily: FONT },
    imageCancel: {
      marginTop: 8,
      paddingVertical: 14,
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
    },
    imageCancelText: {
      color: COLORS.textSecondary,
      fontSize: 16,
      fontFamily: FONT,
    },
  });