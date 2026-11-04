// src/screens/ArtistsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Modal, Pressable, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../hooks/useTheme";
import { useMediaStore } from "../store/mediaStore";
import { useArtistStore } from "../store/artistStore";
import { useId3Tags } from "../hooks/useId3Tags";
import { resolveArtistName, UNKNOWN_ARTIST } from "../utils/cleanArtistName";

// ✅ shared header (top bar + title + search)
import LibraryPageHeaders from "../components/LibraryPageHeaders";

const LIST_ICON = require("../../assets/images/list.png");
const FONT = "sans-serif";

const StarFillIcon = ({ color = "#f92c47", size = 14 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={color}
    />
  </Svg>
);

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

type ArtistGroup = { name: string; songs: any[] };

export default function ArtistsScreen() {
  const nav = useNavigation<any>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const songs = useMediaStore((s: any) => s.songs ?? []);
  const { tagData } = useId3Tags(songs);

  const favourites = useArtistStore((s) => s.favourites);
  const hydrate = useArtistStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "favourites">("all");
  const [menuVisible, setMenuVisible] = useState(false);

  const artistGroups = useMemo<ArtistGroup[]>(() => {
    const map = new Map<string, ArtistGroup>();
    songs.forEach((s: any) => {
      const name = resolveArtistName(s.artist, tagData[s.id]?.artist);
      if (name === UNKNOWN_ARTIST) return;
      const key = name.toLowerCase();
      let g = map.get(key);
      if (!g) { g = { name, songs: [] }; map.set(key, g); }
      g.songs.push(s);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [songs, tagData]);

  const filtered = useMemo(() => {
    let list = artistGroups;
    if (filterMode === "favourites") list = list.filter((g) => !!favourites[g.name]);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((g) => g.name.toLowerCase().includes(q));
    return list;
  }, [artistGroups, filterMode, search, favourites]);

  const renderArtist = ({ item }: { item: ArtistGroup }) => {
    const isFav = !!favourites[item.name];
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => nav.navigate("ArtistDetails", { artistName: item.name })}
      >
        <View style={[styles.artWrap, { backgroundColor: theme.surface }]}>
          <ArtistPlaceholder color={theme.primary} size={30} />
        </View>
        <View style={styles.info}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={[styles.count, { color: theme.textSecondary }]}>
            {item.songs.length} {item.songs.length === 1 ? "song" : "songs"}
          </Text>
        </View>
        {isFav && <StarFillIcon color={theme.primary} size={14} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ---------- SHARED HEADER (top bar + title + search) ---------- */}
      <LibraryPageHeaders
        colors={theme}
        topInset={insets.top}
        title="Artists"
        onBack={() => nav.goBack()}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search in Artists"
        actions={[
          {
            key: "menu",
            icon: LIST_ICON,
            iconStyle: { width: 23, height: 20 },
            onPress: () => setMenuVisible(true),
          },
        ]}
      />

      {/* ---------- LIST ---------- */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={renderArtist}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: 84 }} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {filterMode === "favourites" ? "No favourite artists" : "No artists found"}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {filterMode === "favourites"
                ? "Tap the star on an artist to add them here."
                : "Scan your library to find artists."}
            </Text>
          </View>
        }
      />

      {/* ---------- MENU (unchanged popup card) ---------- */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <View
            style={[styles.menuCard, { backgroundColor: theme.surface, borderColor: theme.border, top: insets.top + 44, right: 10 }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { setMenuVisible(false); nav.navigate("Settings"); }}
              >
                <Text style={[styles.menuText, { color: theme.text }]}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { setMenuVisible(false); nav.navigate("Account"); }}
              >
                <Text style={[styles.menuText, { color: theme.text }]}>Account</Text>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />

              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { setMenuVisible(false); setFilterMode("all"); }}
              >
                <Text style={[styles.menuText, { color: filterMode === "all" ? theme.primary : theme.text }]}>
                  All Artist
                </Text>
                {filterMode === "all" && <Text style={{ color: theme.primary, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { setMenuVisible(false); setFilterMode("favourites"); }}
              >
                <Text style={[styles.menuText, { color: filterMode === "favourites" ? theme.primary : theme.text }]}>
                  Favourites
                </Text>
                {filterMode === "favourites" && <Text style={{ color: theme.primary, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================================
// Styles — header styles removed (they now live in LibraryPageHeaders)
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  artWrap: {
    width: 56, height: 56, borderRadius: 28, overflow: "hidden",
    marginRight: 14, alignItems: "center", justifyContent: "center",
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 16.5, fontWeight: "600", fontFamily: FONT },
  count: { fontSize: 13, marginTop: 2, fontFamily: FONT },

  empty: { paddingHorizontal: 24, paddingTop: 60, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: FONT },
  emptyText: { fontSize: 13, marginTop: 8, textAlign: "center", fontFamily: FONT },

  menuBackdrop: { flex: 1, backgroundColor: "transparent" },
  menuCard: {
    position: "absolute", width: 190, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 18,
  },
  menuRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  menuText: { fontSize: 15, fontWeight: "500", fontFamily: FONT },
  menuDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 8, marginVertical: 4 },
});