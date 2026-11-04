// src/screens/MusicVideosScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../hooks/useTheme";
import { showToast } from "../utils/toast";
import { PlayIcon, ShuffleIcon } from "../icons/Icons";
import { CheckIcon } from "../icons/VideoIcons";
import { MUSIC_VIDEOS, MusicVideo } from "../data/musicVideos";
import { useVideoStore } from "../store/videoStore";

// ✅ Shared header (top bar + title + search)
import LibraryPageHeaders from "../components/LibraryPageHeaders";

const FONT = "sans-serif";
const LIST_ICON = require("../../assets/images/list.png");

// ── ACTION ROW styling (Play / Shuffle) ─────────────────────────────────────
const ACTION_RADIUS = 26;
const ACTION_HEIGHT = 52;
const ACTION_TOP_GAP = 22;

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

type Filter = "all" | "fav";
type Sort = "artist" | "title" | "recent";

export default function MusicVideosScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  // 👇 grid dimensions
  const GRID_GAP = 10;
  const PADDING_H = 12;
  const cardW = Math.floor((winW - PADDING_H * 2 - GRID_GAP) / 2);
  const cardH = Math.round((cardW * 9) / 16);

  // theme merge (same pattern as Playlists / Artists / Albums)
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
  const styles = useMemo(
    () => createStyles(COLORS, PADDING_H),
    [themeRaw], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const favourites = useVideoStore((s) => s.favourites);
  const loadFavs = useVideoStore((s) => s.loadFavs);
  const playQueue = useVideoStore((s) => s.playQueue);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadFavs();
  }, [loadFavs]);

  // ── navigation helper (same approach as LibraryScreen) ──────────────────
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
      showToast(`"${name}" screen is not registered in the navigator`);
      return false;
    },
    [nav],
  );

  // ── list (filter → search → sort) ───────────────────────────────────────
  const list: MusicVideo[] = useMemo(() => {
    let l = MUSIC_VIDEOS.slice();
    if (filter === "fav") l = l.filter((v) => favourites[v.id]);

    const q = query.trim().toLowerCase();
    if (q) {
      l = l.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.artist.toLowerCase().includes(q),
      );
    }

    if (sort === "artist") {
      l.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sort === "title") {
      l.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      l.sort((a, b) => b.addedAt - a.addedAt);
    }
    return l;
  }, [filter, sort, query, favourites]);

  const playAll = () => {
    if (!list.length) return showToast("No music videos");
    playQueue(list, 0);
  };

  const shuffleAll = () => {
    if (!list.length) return showToast("No music videos");
    const shuffled = list.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    playQueue(shuffled, 0);
  };

  // ── bottom-sheet menu row helper ────────────────────────────────────────
  const SheetRow = ({
    label,
    selected,
    onPress,
    onPressOverride,
  }: {
    label: string;
    selected?: boolean;
    onPress?: () => void;
    onPressOverride?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.sheetItem}
      activeOpacity={0.7}
      onPress={onPressOverride ?? onPress}
    >
      <Text
        style={[
          styles.sheetCheck,
          selected && { color: COLORS.text },
        ]}
      >
        {selected ? "✓" : ""}
      </Text>
      <Text
        style={[
          styles.sheetItemText,
          selected && { color: COLORS.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const emptyText =
    filter === "fav" && !query.trim()
      ? "No favourite music videos yet."
      : "No music videos found.";

  return (
    <View style={styles.container}>
      {/* ---------- SHARED HEADER ---------- */}
      <LibraryPageHeaders
        colors={COLORS}
        topInset={insets.top}
        title="Music Videos"
        onBack={() => nav.goBack()}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search in Music Videos"
        actions={[
          {
            key: "menu",
            icon: LIST_ICON,
            iconStyle: { width: 23, height: 20 },
            onPress: () => setShowMenu(true),
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Play / Shuffle */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.75}
            onPress={playAll}
          >
            <PlayIcon size={20} color={COLORS.primary} />
            <Text style={styles.actionLabel}>Play</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.75}
            onPress={shuffleAll}
          >
            <ShuffleIcon size={20} color={COLORS.primary} />
            <Text style={styles.actionLabel}>Shuffle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listDivider} />

        {/* Video grid */}
        {list.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : (
          <View style={styles.gridWrap}>
            {list.map((v, i) => (
              <TouchableOpacity
                key={v.id}
                style={{ width: cardW }}
                activeOpacity={0.8}
                onPress={() => playQueue(list, i)}
              >
                <View
                  style={[
                    styles.gridThumbWrap,
                    { width: cardW, height: cardH },
                  ]}
                >
                  <Image
                    source={{ uri: v.thumbnail }}
                    style={styles.thumb}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                </View>

                <Text numberOfLines={1} style={styles.gridTitle}>
                  {v.title}
                </Text>
                <Text numberOfLines={1} style={styles.gridArtist}>
                  {v.artist}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 200 }} />
      </ScrollView>

      {/* ---------- MENU BOTTOM SHEET (matches Playlists/Artists) ---------- */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowMenu(false)}
        >
          <View
            style={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}
          >
            {/* Settings / Account */}
            <SheetRow
              label="Settings"
              onPressOverride={() => {
                setShowMenu(false);
                navigateTo("Settings");
              }}
            />
            <SheetRow
              label="Account"
              onPressOverride={() => {
                setShowMenu(false);
                navigateTo("Account");
              }}
            />

            <View style={styles.sheetDivider} />

            {/* Filter */}
            <SheetRow
              label="All Music Videos"
              selected={filter === "all"}
              onPress={() => {
                setFilter("all");
                setShowMenu(false);
              }}
            />
            <SheetRow
              label="Favourites"
              selected={filter === "fav"}
              onPress={() => {
                setFilter("fav");
                setShowMenu(false);
              }}
            />

            <View style={styles.sheetDivider} />

            {/* Sort */}
            <SheetRow
              label="Artist"
              selected={sort === "artist"}
              onPress={() => {
                setSort("artist");
                setShowMenu(false);
              }}
            />
            <SheetRow
              label="Title"
              selected={sort === "title"}
              onPress={() => {
                setSort("title");
                setShowMenu(false);
              }}
            />
            <SheetRow
              label="Recently Added"
              selected={sort === "recent"}
              onPress={() => {
                setSort("recent");
                setShowMenu(false);
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================================
// Styles — header styles removed (now in LibraryPageHeaders)
// ============================================================
const createStyles = (COLORS: any, paddingH: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    content: { paddingHorizontal: paddingH, paddingTop: 6 },

    // Play / Shuffle buttons
    actionRow: { flexDirection: "row", gap: 12, marginTop: ACTION_TOP_GAP },
    actionBtn: {
      flex: 1,
      height: ACTION_HEIGHT,
      borderRadius: ACTION_RADIUS,
      backgroundColor: "#1c1c1e",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    actionLabel: {
      color: COLORS.primary,
      fontSize: 17,
      fontWeight: "600",
      fontFamily: FONT,
    },

    listDivider: {
      height: StyleSheet.hairlineWidth * 2,
      backgroundColor: COLORS.border,
      opacity: 0.9,
      marginTop: 16,
      marginBottom: 6,
    },

    gridWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      rowGap: 18,
      marginTop: 10,
    },
    gridThumbWrap: {
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: COLORS.surface,
      borderWidth: 0.5,
      borderColor: "rgba(255, 255, 255, 0.34)",
    },
    thumb: { width: "100%", height: "100%" },
    gridTitle: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 8,
      fontFamily: FONT,
    },
    gridArtist: {
      color: COLORS.textSecondary,
      fontSize: 14,
      marginTop: 2,
      fontFamily: FONT,
    },
    empty: {
      color: COLORS.textMuted,
      fontSize: 15,
      textAlign: "center",
      paddingVertical: 40,
      fontFamily: FONT,
    },

    // ---------- bottom sheet (same visual language as Playlists/Artists) ----------
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
      borderColor: COLORS.border,
      borderBottomWidth: 0,
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
      color: COLORS.textSecondary,
      fontSize: 16,
      fontFamily: FONT,
    },
    sheetDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.border,
      marginVertical: 4,
    },
  });