// ============================================================
//  src/screens/PlaylistsScreen.tsx
// ============================================================
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput as RNTextInput,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { useTheme } from "../hooks/useTheme";
import { usePlayerStore } from "../store/playerStore";
import { showToast } from "../utils/toast";
import LibraryPageHeaders from "../components/LibraryPageHeaders";
import { UserPlaylistIcon } from "../icons/Icons";

// Assets (only assets this screen still needs directly)
const LIST_ICON = require("../../assets/images/list.png");
const FAVOURITE_HERO = require("../../assets/images/favouritepageimage.png");
const CREATE_PLAYLIST_ICON = require("../../assets/icons/createplaylisticona.png");
const MORE_ICON = require("../../assets/apple/moreicon.png");
const CAMERA_ICON = require("../../assets/icons/cameraicon.png");

const FONT = "sans-serif";
const STORAGE_PLAYLISTS = "@library_playlists";

// ============================================================
// Glass Settings
// ============================================================
const GLASS_SETTINGS = {
  distortionStrength: 40,
  frostBlur: 16,
  tintColor: 28,
  tintOpacity: 0.6,
  shadowSpread: 0,
  shadowBlur: 20,
};

const DEFAULT_COLORS = {
  background: "#1c1c1e",
  surface: "#434446",
  surfaceLight: "#45464a",
  border: "#3f4042",
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
  pinned?: boolean;
  favourite?: boolean;
};

type SortKey = "title" | "recent" | "played" | "type";
type FilterKey = "all" | "favourites";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "recent", label: "Recently Added" },
  { key: "played", label: "Recently Played" },
  { key: "type", label: "Playlist Type" },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All playlists" },
  { key: "favourites", label: "Favourites" },
];

export default function PlaylistsScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const themeRaw = useTheme() as any;
  const base =
    themeRaw && typeof themeRaw === "object" && themeRaw.background
      ? themeRaw
      : themeRaw?.colors && typeof themeRaw.colors === "object"
        ? themeRaw.colors
        : DEFAULT_COLORS;

  const COLORS = useMemo(() => ({ ...DEFAULT_COLORS, ...base }), [base]);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Long-press playlist action sheet
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null,
  );

  // Create Playlist States
  const [newName, setNewName] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const currentSong = usePlayerStore(
    (s: any) => s.currentSong ?? s.currentTrack ?? null,
  );
  const isPlaying = !!currentSong;

  // ---------- load ----------
const loadPlaylists = useCallback(async () => {
  try {
    setLoading(true);

    const raw = await AsyncStorage.getItem(STORAGE_PLAYLISTS);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      throw new Error("Invalid playlist storage format");
    }

    setPlaylists(parsed);

    console.log("[Playlists] Loaded:", parsed.length);
  } catch (error) {
    console.error("[Playlists] Load failed:", error);
    showToast("Could not load playlists");
    setPlaylists([]);
  } finally {
    setLoading(false);
  }
}, []);

  useFocusEffect(
    useCallback(() => {
      loadPlaylists();
    }, [loadPlaylists]),
  );

  // ---------- save helper ----------
const savePlaylists = useCallback(async (next: Playlist[]) => {
  try {
    await AsyncStorage.setItem(
      STORAGE_PLAYLISTS,
      JSON.stringify(next)
    );

    setPlaylists(next);

    console.log("[Playlists] Saved:", next.length);
    return true;
  } catch (error) {
    console.error("[Playlists] Save failed:", error);
    showToast("Could not save playlists");
    return false;
  }
}, []);

  // ---------- sorting / filtering ----------
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = q
      ? playlists.filter((p) => p.name.toLowerCase().includes(q))
      : playlists;

    if (filterKey === "favourites") {
      filtered = filtered.filter((p) => p.favourite);
    }

    const list = [...filtered];

    switch (sortKey) {
      case "title":
      case "type":
        list.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
        break;
      case "recent":
        list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        break;
      case "played":
        list.sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
        break;
    }

    // ✅ Pinned playlists always float to the top
    list.sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      return bp - ap;
    });

    return list;
  }, [playlists, query, sortKey, filterKey]);

  // ---------- Image Picker Logic ----------
const persistArtwork = async (tempUri: string): Promise<string> => {
  const dir = `${FileSystem.documentDirectory}playlist_artwork/`;

  try {
    const info = await FileSystem.getInfoAsync(dir);

    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, {
        intermediates: true,
      });
    }

    const ext = (tempUri.split(".").pop() || "jpg").split("?")[0];
    const dest = `${dir}pl_${Date.now()}.${ext}`;

    await FileSystem.copyAsync({
      from: tempUri,
      to: dest,
    });

    return dest;
  } catch (error) {
    console.error("[Playlists] Artwork save failed:", error);
    throw error;
  }
};

  const handleTakePhoto = async () => {
    setImageMenuOpen(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Camera access is required.");
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
        Alert.alert("Permission needed", "Photo library access is required.");
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

  // ---------- Actions ----------
  const deletePlaylist = (pl: Playlist) => {
    Alert.alert("Delete playlist", `Delete "${pl.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
    onPress: async () => {
  const next = playlists.filter((p) => p.id !== pl.id);

  const saved = await savePlaylists(next);

  if (saved) {
    showToast("Playlist deleted");
  }
},
      },
    ]);
  };

const createPlaylist = async () => {
  const name = newName.trim();

  if (!name || creating) return;

  setCreating(true);

  try {
    const savedArtwork = coverImage
      ? await persistArtwork(coverImage)
      : null;

    const now = Date.now();

    const pl: Playlist = {
      id: `pl_${now}`,
      name,
      artwork: savedArtwork,
      songs: [],
      createdAt: now,
      updatedAt: now,
    };

    const next = [pl, ...playlists];

    const saved = await savePlaylists(next);

    if (!saved) return;

    setCreateOpen(false);
    setNewName("");
    setCoverImage(null);

    showToast("Playlist created");

    console.log("[Playlists] Created:", name);
  } catch (error) {
    console.error("[Playlists] Create failed:", error);
    showToast("Could not create playlist");
  } finally {
    setCreating(false);
  }
};

  // ---------- Long press → open action sheet ----------
  const openActionSheet = (pl: Playlist) => {
    setSelectedPlaylist(pl);
    setActionSheetOpen(true);
  };

  const closeActionSheet = () => {
    setActionSheetOpen(false);
    setTimeout(() => setSelectedPlaylist(null), 200);
  };

  // ---- Action handlers ----
const handleTogglePin = async () => {
  if (!selectedPlaylist) return;

  const pl = selectedPlaylist;

  const next = playlists.map((p) =>
    p.id === pl.id
      ? { ...p, pinned: !p.pinned, updatedAt: Date.now() }
      : p
  );

  const saved = await savePlaylists(next);

  if (saved) {
    showToast(
      pl.pinned
        ? "Unpinned from library"
        : "Pinned to library top"
    );

    closeActionSheet();
  }
};

  const handleDeleteFromLibrary = () => {
    const pl = selectedPlaylist;
    closeActionSheet();
    if (!pl) return;
    setTimeout(() => deletePlaylist(pl), 250);
  };

const handleToggleFavourite = async () => {
  if (!selectedPlaylist) return;

  const pl = selectedPlaylist;

  const next = playlists.map((p) =>
    p.id === pl.id
      ? { ...p, favourite: !p.favourite, updatedAt: Date.now() }
      : p
  );

  const saved = await savePlaylists(next);

  if (saved) {
    showToast(
      pl.favourite
        ? "Removed from Favourites"
        : "Added to Favourites"
    );

    closeActionSheet();
  }
};

  const handlePlayNext = async () => {
    const pl = selectedPlaylist;
    closeActionSheet();
    if (!pl) return;
    try {
      const songs = Array.isArray(pl.songs) ? pl.songs : [];
      if (songs.length === 0) {
        showToast("Playlist is empty");
        return;
      }
      const playerStore = usePlayerStore.getState() as any;
      if (typeof playerStore.addToQueue === "function") {
        playerStore.addToQueue(songs, "next");
        showToast("Added to play next");
      } else if (typeof playerStore.enqueueNext === "function") {
        playerStore.enqueueNext(songs);
        showToast("Added to play next");
      } else if (typeof playerStore.addToQueueNext === "function") {
        playerStore.addToQueueNext(songs);
        showToast("Added to play next");
      } else {
        showToast("Play next not available");
      }
    } catch (e) {
      console.warn("[Playlists] play next failed:", e);
      showToast("Could not add to play next");
    }
  };

  // ---------- renderers ----------
  const renderPlaylist = ({ item }: { item: Playlist }) => {
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => nav.navigate("PlaylistDetails", { playlistId: item.id })}
        onLongPress={() => openActionSheet(item)}
        delayLongPress={250}
      >
        <View style={styles.plIcon}>
          {item.artwork ? (
            <Image
              source={{ uri: item.artwork }}
              style={styles.plIconImg}
              resizeMode="cover"
            />
          ) : (
            <UserPlaylistIcon size={55} color={COLORS.inactive} />
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ---------------- HEADERS (extracted component) ---------------- */}
      <LibraryPageHeaders
        colors={COLORS}
        topInset={insets.top}
        title="Playlists"
        onBack={() => nav.goBack()}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search in Playlists"
        actions={[
          {
            key: "create",
            icon: CREATE_PLAYLIST_ICON,
            onPress: () => setCreateOpen(true),
          },
          {
            key: "filter",
            icon: LIST_ICON,
            iconStyle: { width: 23, height: 20 },
            onPress: () => setFilterOpen(true),
          },
          {
            key: "sort",
            icon: MORE_ICON,
            iconStyle: { width: 18, height: 20 },
            onPress: () => setSortOpen(true),
          },
        ]}
      />

      {/* ---------------- LIST ---------------- */}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderPlaylist}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        contentContainerStyle={{
          paddingTop: 4,
          paddingBottom: isPlaying ? 260 : 220,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          filterKey === "all" ? (
            <View>
              <TouchableOpacity
                style={styles.favRow}
                activeOpacity={0.75}
                onPress={() => nav.navigate("FavouriteSongs")}
              >
                <Image source={FAVOURITE_HERO} style={styles.favArt} />
                <View style={styles.info}>
                  <Text style={styles.name}>Favourite Songs</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.divider} />
            </View>
          ) : null
        }
      />

      {/* ============================================================ */}
      {/* ------------------ FILTER BOTTOM SHEET --------------------- */}
      {/* ============================================================ */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setFilterOpen(false)}
        >
          <View
            style={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}
          >
            <Text style={styles.sheetTitle}>Filter By</Text>
            {FILTERS.map((f) => {
              const active = f.key === filterKey;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={styles.sheetItem}
                  onPress={() => {
                    setFilterKey(f.key);
                    setFilterOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sheetCheck,
                      active && { color: COLORS.text },
                    ]}
                  >
                    {active ? "✓" : ""}
                  </Text>
                  <Text
                    style={[
                      styles.sheetItemText,
                      active && { color: COLORS.text },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* ============================================================ */}
      {/* ------------------ SORT BOTTOM SHEET ----------------------- */}
      {/* ============================================================ */}
      <Modal
        visible={sortOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSortOpen(false)}
        >
          <View
            style={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}
          >
            <Text style={[styles.sheetTitle, { textAlign: "center" }]}>
              Sort by
            </Text>
            {SORTS.map((s) => {
              const active = s.key === sortKey;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={styles.sheetItem}
                  onPress={() => {
                    setSortKey(s.key);
                    setSortOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sheetCheck,
                      active && { color: COLORS.text },
                    ]}
                  >
                    {active ? "✓" : ""}
                  </Text>
                  <Text
                    style={[
                      styles.sheetItemText,
                      active && { color: COLORS.text },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* ============================================================ */}
      {/* ---------------- LONG-PRESS ACTION SHEET ------------------- */}
      {/* ============================================================ */}
      <Modal
        visible={actionSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={closeActionSheet}
      >
        <Pressable style={styles.actionBackdrop} onPress={closeActionSheet}>
          <Pressable
            style={[styles.actionSheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e: any) => e.stopPropagation()}
          >
            {selectedPlaylist && (
              <>
                <View style={styles.actionHeader}>
                  <View style={styles.actionArtWrap}>
                    {selectedPlaylist.artwork ? (
                      <Image
                        source={{ uri: selectedPlaylist.artwork }}
                        style={styles.actionArt}
                        resizeMode="cover"
                      />
                    ) : (
                      <UserPlaylistIcon size={34} color={COLORS.primary} />
                    )}
                  </View>
                  <Text style={styles.actionName} numberOfLines={1}>
                    {selectedPlaylist.name}
                  </Text>
                </View>

                <View style={styles.actionDivider} />

                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handleTogglePin}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionItemText}>
                    {selectedPlaylist.pinned
                      ? "Unpin playlist"
                      : "Pin playlist"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handleDeleteFromLibrary}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionItemText, { color: "#E53935" }]}>
                    Delete from library
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handleToggleFavourite}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionItemText}>
                    {selectedPlaylist.favourite
                      ? "Undo Favourite"
                      : "Favourite"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={handlePlayNext}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionItemText}>Play next</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCancel}
                  onPress={closeActionSheet}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ============================================================ */}
      {/* ------------- CREATE PLAYLIST MODAL ------------------------ */}
      {/* ============================================================ */}
      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.createBackdrop}
            onPress={() => setCreateOpen(false)}
          >
            <Pressable
              style={[
                styles.createSheet,
                { paddingBottom: insets.bottom + 20 },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.createTopBar}>
                  <TouchableOpacity
                    onPress={() => setCreateOpen(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.crossIcon}>✕</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={createPlaylist}
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
                  onPress={() => setImageMenuOpen(true)}
                  style={styles.coverUpload}
                  activeOpacity={0.8}
                >
                  {coverImage ? (
                    <Image
                      source={{ uri: coverImage }}
                      style={styles.coverImage}
                    />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <View style={styles.cameraIconBg}>
                        <Image
                          source={CAMERA_ICON}
                          style={styles.cameraIconImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                <RNTextInput
                  style={styles.input}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Playlist Title"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={50}
                  cursorColor="#ffffff"
                  selectionColor="#ffffff"
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================================ */}
      {/* -------------- IMAGE PICKER BOTTOM SHEET ------------------- */}
      {/* ============================================================ */}
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
    </View>
  );
}

// ============================================================
// Styles (headers styles removed — now live in LibraryPageHeaders)
// ============================================================
const createStyles = (C: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    // ---------- list rows ----------
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.border,
      marginLeft: 102,
      marginRight: 16,
    },
    favRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    favArt: {
      width: 72,
      height: 72,
      borderRadius: 6,
      borderWidth: 0.5,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    plIcon: {
      width: 72,
      height: 72,
      borderRadius: 6,
      borderWidth: 0.5,
      borderColor: C.border,
      backgroundColor: C.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    plIconImg: { width: "100%", height: "100%", opacity: 0.9 },
    info: { flex: 1, marginLeft: 14, justifyContent: "center" },
    name: {
      color: C.text,
      fontSize: 17,
      fontWeight: "600",
      fontFamily: FONT,
    },

    // ---------- mini player ----------
    bottomArea: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "transparent",
    },

    // ---------- Bottom Sheets (Filter/Sort) ----------
    sheetBackdrop: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "flex-end",
    },
    sheetContent: {
      backgroundColor: "#1c1c1e",
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      paddingTop: 16,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: C.border,
      borderBottomWidth: 0,
    },
    sheetTitle: {
      color: C.text,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 16,
      fontFamily: FONT,
      alignSelf: "center",
    },
    sheetItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
    },
    sheetCheck: {
      width: 24,
      fontSize: 16,
      color: "transparent",
      fontWeight: "800",
    },
    sheetItemText: {
      color: C.textSecondary,
      fontSize: 16,
      fontFamily: FONT,
    },

    // ---------- Long-press action sheet ----------
    actionBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    actionSheet: {
      backgroundColor: "#1c1c1e",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      borderBottomWidth: 0,
    },
    actionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    actionArtWrap: {
      width: 46,
      height: 46,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: C.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    actionArt: { width: "100%", height: "100%" },
    actionName: {
      flex: 1,
      marginLeft: 14,
      color: C.text,
      fontSize: 17,
      fontWeight: "700",
      fontFamily: FONT,
    },
    actionDivider: {
      height: StyleSheet.hairlineWidth * 2,
      backgroundColor: C.border,
      marginBottom: 4,
    },
    actionItem: {
      minHeight: 50,
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    actionItemText: {
      color: C.text,
      fontSize: 16,
      fontFamily: FONT,
    },
    actionCancel: {
      marginTop: 8,
      paddingVertical: 14,
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    actionCancelText: {
      color: C.textSecondary,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: FONT,
    },

    // ---------- CREATE MODAL ----------
    createBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    createSheet: {
      backgroundColor: "#1c1c1e",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 20,
      minHeight: 730,
      width: "100%",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      borderBottomWidth: 0,
    },
    createTopBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    crossIcon: {
      color: C.text,
      fontSize: 20,
      fontWeight: "400",
      fontFamily: FONT,
    },
    checkIcon: {
      color: C.primary,
      fontSize: 22,
      fontWeight: "700",
      fontFamily: FONT,
    },
    coverUpload: { alignSelf: "center", marginBottom: 30, marginTop: 20 },
    coverImage: {
      width: 200,
      height: 200,
      borderRadius: 20,
      backgroundColor: C.background,
    },
    coverPlaceholder: {
      width: 200,
      height: 200,
      borderRadius: 20,
      backgroundColor: C.surfaceLight,
      justifyContent: "center",
      alignItems: "center",
    },
    cameraIconBg: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#000000",
      justifyContent: "center",
      alignItems: "center",
    },
    cameraIconImage: {
      width: 36,
      height: 36,
      tintColor: "#ffffff",
    },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      borderTopWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      borderRadius: 0,
      paddingHorizontal: 4,
      paddingVertical: 12,
      color: C.text,
      fontSize: 18,
      fontFamily: FONT,
      backgroundColor: "transparent",
      textAlign: "center",
      marginTop: 10,
      marginBottom: 20,
    },

    // ---------- Image Picker Action Sheet ----------
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
      backgroundColor: "#1c1c1e",
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
    imageSheetTitle: {
      color: C.text,
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
    imageOptionText: {
      color: C.text,
      fontSize: 16,
      fontFamily: FONT,
    },
    imageCancel: {
      marginTop: 8,
      paddingVertical: 14,
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    imageCancelText: {
      color: C.textSecondary,
      fontSize: 16,
      fontFamily: FONT,
    },
  });
