// src/screens/Navigation/SearchScreen.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Keyboard,
  BackHandler,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Header from "../../components/Header";
import { useTheme } from "../../hooks/useTheme";
import TopStatusGlass from "../../components/TopStatusGlass";
import { useMediaStore } from "../../store/mediaStore";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { useArtworkCache } from "../../hooks/useArtworkCache";
import { showToast } from "../../utils/toast";

// ✅ Import your existing ID3 parser
import { readId3Tags } from "../../utils/id3Tags";

const FONT = "sans-serif";

const DEFAULT_COLORS = {
  background: "#000000",
  surface: "#1c1c1e",
  border: "#3a3a3c",
  text: "#ffffff",
  textSecondary: "#a1a1aa",
  primary: "#f92c47",
};

const SEARCH_ICON = require("../../../assets/images/search.png");
const MORE_ICON = require("../../../assets/apple/moreicon.png");
const MUSIC_DEFAULT_PNG = require("../../../assets/images/musicdefault.png");

const CATEGORIES = [
  { id: "1", title: "Best of 2026", color: "#A4C2C9" },
  { id: "2", title: "Pop", color: "#FF4B72" },
  { id: "3", title: "Bollywood", color: "#9D68D9" },
  { id: "4", title: "Punjabi", color: "#8C5CD9" },
  { id: "5", title: "Tamil", color: "#A56DDB" },
  { id: "6", title: "Telugu", color: "#B283E0" },
];

const STORAGE_RECENT = "@search_recent_songs";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { loadAndPlay } = useAudioPlayer();

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
  const styles = useMemo(() => createStyles(COLORS), [themeRaw]);

  // --- Data Stores ---
  const songs = useMediaStore((s: any) => s.songs ?? []);
  const favorites = useMediaStore((s: any) => s.favoritesSong ?? {});
  const toggleFavorite = useMediaStore((s: any) => s.toggleSongFavorite);
  const { artworkMap } = useArtworkCache(songs);

  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY]
  );

  // --- Search State ---
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  
  // --- Popup State ---
  const [selectedSong, setSelectedSong] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Load recently searched from storage
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_RECENT);
        if (stored) setRecentSearches(JSON.parse(stored));
      } catch (e) {}
    };
    loadRecent();
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      if (isSearching) {
        handleBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [isSearching, modalVisible]);

  const addToRecent = async (song: any) => {
    if (!song) return;
    const updated = [song, ...recentSearches.filter((s) => s.id !== song.id)].slice(0, 10);
    setRecentSearches(updated);
    try {
      await AsyncStorage.setItem(STORAGE_RECENT, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleClearRecent = async () => {
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem(STORAGE_RECENT);
    } catch (e) {}
  };

  const handleBack = () => {
    setIsSearching(false);
    setQuery("");
    Keyboard.dismiss();
  };

  const clearInput = () => {
    setQuery("");
    searchInputRef.current?.focus();
  };

  const handleFocus = () => setIsSearching(true);

  // --- Real Song Filtering ---
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return songs.filter((song: any) => {
      const title = (song.title || "").toLowerCase();
      const artist = (song.artist || "").toLowerCase();
      const album = (song.album || "").toLowerCase();
      return title.includes(q) || artist.includes(q) || album.includes(q);
    });
  }, [songs, query]);

  // --- Background metadata patcher using id3Tags.ts ---
  useEffect(() => {
    if (searchResults.length === 0) return;
    let isMounted = true;

    const patchMissingMetadata = async () => {
      let updatedAny = false;
      const store = useMediaStore.getState();
      const updatedSongs = [...store.songs];

      for (let i = 0; i < updatedSongs.length; i++) {
        const song = updatedSongs[i];
        const isMatch = searchResults.some((s: any) => s.id === song.id);
        if (!isMatch) continue;

        const needsArtist = !song.artist || song.artist === "Unknown Artist" || song.artist === "Unknown artist";
        const needsAlbum = !song.album || song.album === "Unknown Album" || song.album === "Unknown album";
        
        if ((needsArtist || needsAlbum) && (song.uri || (song as any).path)) {
          const uri = song.uri || (song as any).path;
          try {
            const tags = await readId3Tags(uri);
            
            if (tags.artist || tags.album) {
              updatedSongs[i] = {
                ...song,
                artist: tags.artist || song.artist,
                album: tags.album || song.album,
              };
              updatedAny = true;
            }
          } catch (e) {
            console.warn("Failed to read tags for", song.title, e);
          }
        }
      }

      if (updatedAny && isMounted) {
        useMediaStore.setState({ songs: updatedSongs });
      }
    };

    patchMissingMetadata();
    return () => { isMounted = false; };
  }, [searchResults]);

  // --- Real Search Suggestions ---
  const searchSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const suggestionsSet = new Set<string>();

    for (const song of searchResults) {
      const fieldsToCheck = [song.title, song.artist, song.album];
      
      for (const field of fieldsToCheck) {
        if (!field) continue;
        const lowerField = field.toLowerCase();
        
        if (lowerField.includes(q)) {
           const words = field.split(/\s+/);
           const matchIndex = words.findIndex(w => w.toLowerCase().includes(q));
           
           if (matchIndex !== -1) {
             const suggestion = words.slice(matchIndex, matchIndex + 4).join(" ");
             const cleanSuggestion = suggestion.replace(/[-,()]/g, "").trim();
             if (cleanSuggestion.length > 1) {
               suggestionsSet.add(cleanSuggestion);
             }
           }
        }
      }

      if (suggestionsSet.size >= 5) break;
    }

    return Array.from(suggestionsSet);
  }, [searchResults, query]);

  const playSong = async (song: any) => {
    addToRecent(song);
    const index = searchResults.findIndex((s: any) => s.id === song.id);
    const queueToPlay = index >= 0 ? searchResults : [song];
    const playIndex = index >= 0 ? index : 0;

    try {
      await loadAndPlay(queueToPlay, playIndex);
    } catch {
      showToast("Playback failed");
    }
  };

  // --- Popup Actions ---
  const openPopup = (song: any) => {
    setSelectedSong(song);
    setModalVisible(true);
  };

  const closePopup = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedSong(null), 300);
  };

  const handlePlayNext = () => {
    showToast(`"${selectedSong.title}" will play next`);
    closePopup();
  };

  const handleAddToLibrary = () => {
    showToast(`"${selectedSong.title}" added to library`);
    closePopup();
  };

  const handleToggleFavourite = () => {
    const isFav = !!favorites[selectedSong.id];
    toggleFavorite(selectedSong.id);
    showToast(isFav ? "Removed from Favourites" : "Added to Favourites");
    closePopup();
  };

  const backIconOpacity = useRef(new Animated.Value(0)).current;
  const backIconScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backIconOpacity, {
        toValue: isSearching ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(backIconScale, {
        toValue: isSearching ? 1 : 0.8,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSearching]);

  const selectedSongArt = selectedSong
    ? selectedSong.artwork ?? selectedSong.artworkUri ?? artworkMap[selectedSong.id]
    : null;

  const isSelectedSongFav = selectedSong ? !!favorites[selectedSong.id] : false;

  return (
    <View style={styles.container}>
      {!isSearching && <Header title="Search" scrollY={scrollY} />}

      <View style={[styles.stickySearchWrapper, { top: isSearching ? insets.top + 10 : 75 + insets.top }]}>
        <View style={[styles.searchBar, { backgroundColor: COLORS.surface }]}>
          <Animated.View
            style={{
              opacity: backIconOpacity,
              transform: [{ scale: backIconScale }],
              marginRight: isSearching ? 10 : 0,
              width: isSearching ? 24 : 0,
              overflow: "hidden",
            }}
          >
            <TouchableOpacity onPress={handleBack} hitSlop={10}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42a.996.996 0 0 0-1.41 0l-6.59 6.59a.996.996 0 0 0 0 1.41l6.59 6.59a.996.996 0 1 0 1.41-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1"
                  fill={COLORS.text}
                />
              </Svg>
            </TouchableOpacity>
          </Animated.View>

          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: COLORS.text }]}
            placeholder="Artists, Songs, Albums..."
            placeholderTextColor={COLORS.textSecondary}
            value={query}
            onChangeText={setQuery}
            onFocus={handleFocus}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />

          {isSearching && query.length > 0 && (
            <TouchableOpacity onPress={clearInput} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
               <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={COLORS.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}

          {!isSearching && (
            <Image source={SEARCH_ICON} style={[styles.searchIcon, { tintColor: COLORS.textSecondary }]} resizeMode="contain" />
          )}
        </View>
      </View>

      {!isSearching && (
        <Animated.ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 75 + insets.top + 70 }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.gridContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.id} style={[styles.categoryCard, { backgroundColor: cat.color }]} activeOpacity={0.8}>
                <Text style={styles.categoryTitle}>{cat.title}</Text>
                <View style={styles.categoryImagePlaceholder} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 200 }} />
        </Animated.ScrollView>
      )}

      {isSearching && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 + 70 }]}
        >
          {query.trim().length > 0 ? (
            <>
              {searchSuggestions.length > 0 && (
                <View style={styles.suggestionsList}>
                  {searchSuggestions.map((suggestion, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.suggestionRow}
                      onPress={() => setQuery(suggestion)}
                    >
                      <Image source={SEARCH_ICON} style={[styles.suggestionIcon, { tintColor: COLORS.textSecondary }]} resizeMode="contain" />
                      <Text style={[styles.suggestionText, { color: COLORS.text }]} numberOfLines={1}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.recentList}>
                {searchResults.length > 0 ? (
                  searchResults.map((song: any) => {
                    const art = song.artwork ?? song.artworkUri ?? artworkMap[song.id];
                    return (
                      <View key={song.id}>
                        <TouchableOpacity style={styles.recentRow} activeOpacity={0.7} onPress={() => playSong(song)}>
                          <Image source={art ? { uri: art } : MUSIC_DEFAULT_PNG} style={styles.recentArt} />
                          <View style={styles.recentInfo}>
                            <Text numberOfLines={1} style={[styles.recentRowTitle, { color: COLORS.text }]}>
                              {song.title || "Unknown"}
                            </Text>
                            <Text numberOfLines={1} style={[styles.recentRowSub, { color: COLORS.textSecondary }]}>
                              Song • {song.artist || "Unknown Artist"}
                            </Text>
                          </View>
                          
                          <TouchableOpacity 
                            onPress={() => openPopup(song)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Image source={MORE_ICON} style={[styles.moreIcon, { tintColor: COLORS.textSecondary }]} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: COLORS.border }]} />
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
                      No results found
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {recentSearches.length > 0 && (
                <>
                  <View style={styles.recentHeader}>
                    <Text style={[styles.recentTitle, { color: COLORS.text }]}>Recently Searched</Text>
                    <TouchableOpacity onPress={handleClearRecent} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={[styles.clearText, { color: COLORS.primary }]}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recentList}>
                    {recentSearches.map((song, index) => {
                      const art = song.artwork ?? song.artworkUri ?? artworkMap[song.id];
                      return (
                        <View key={song.id + index}>
                          <TouchableOpacity
                            style={styles.recentRow}
                            activeOpacity={0.7}
                            onPress={() => playSong(song)}
                          >
                            <Image source={art ? { uri: art } : MUSIC_DEFAULT_PNG} style={styles.recentArt} />
                            <View style={styles.recentInfo}>
                              <Text numberOfLines={1} style={[styles.recentRowTitle, { color: COLORS.text }]}>
                                {song.title || "Unknown"}
                              </Text>
                              <Text numberOfLines={1} style={[styles.recentRowSub, { color: COLORS.textSecondary }]}>
                                Song • {song.artist || "Unknown Artist"}
                              </Text>
                            </View>
                            
                            <TouchableOpacity
                              onPress={() => openPopup(song)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Image source={MORE_ICON} style={[styles.moreIcon, { tintColor: COLORS.textSecondary }]} />
                            </TouchableOpacity>
                          </TouchableOpacity>
                          {index < recentSearches.length - 1 && (
                            <View style={[styles.divider, { backgroundColor: COLORS.border }]} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}
          <View style={{ height: 200 }} />
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closePopup}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePopup}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            
            {selectedSong && (
              <>
                <View style={styles.songHeader}>
                  <Image 
                    source={selectedSongArt ? { uri: selectedSongArt } : MUSIC_DEFAULT_PNG} 
                    style={styles.songHeaderArt} 
                  />
                  <View style={styles.songHeaderText}>
                    <Text style={[styles.songHeaderTitle, { color: COLORS.text }]} numberOfLines={1}>
                      {selectedSong.title || "Unknown"}
                    </Text>
                    <Text style={[styles.songHeaderArtist, { color: COLORS.textSecondary }]} numberOfLines={1}>
                      {selectedSong.artist || "Unknown Artist"}
                    </Text>
                    <Text style={[styles.songHeaderAlbum, { color: COLORS.textSecondary }]} numberOfLines={1}>
                      {selectedSong.album || "Unknown Album"}
                    </Text>
                  </View>
                </View>

                <View style={[styles.sheetDivider, { backgroundColor: COLORS.border }]} />

                <TouchableOpacity style={styles.optionRow} onPress={handlePlayNext}>
                  <Text style={[styles.optionText, { color: COLORS.text }]}>Play next</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionRow} onPress={handleAddToLibrary}>
                  <Text style={[styles.optionText, { color: COLORS.text }]}>Add to Library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionRow} onPress={handleToggleFavourite}>
                  <Text style={[styles.optionText, { color: COLORS.text }]}>
                    {isSelectedSongFav ? "Undo favourite" : "Favourite"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <TopStatusGlass />
    </View>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    stickySearchWrapper: { position: "absolute", left: 0, right: 0, zIndex: 10, paddingHorizontal: 16 },
    searchBar: {
      flexDirection: "row", alignItems: "center", height: 54, borderRadius: 12, paddingHorizontal: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
    },
    searchInput: { flex: 1, fontSize: 17, fontFamily: FONT, fontWeight: "400", paddingVertical: 0 },
    searchIcon: { width: 20, height: 20, marginLeft: 8 },
    scrollContent: { paddingHorizontal: 16 },
    gridContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    categoryCard: { width: "48%", height: 100, borderRadius: 10, marginBottom: 12, padding: 12, overflow: "hidden", position: "relative" },
    categoryTitle: { color: "#ffffff", fontSize: 18, fontWeight: "800", fontFamily: FONT, letterSpacing: -0.3, zIndex: 2 },
    categoryImagePlaceholder: { position: "absolute", bottom: -10, right: -10, width: 80, height: 80, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 40, transform: [{ rotate: "25deg" }] },

    suggestionsList: { marginBottom: 16 },
    suggestionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
    suggestionIcon: { width: 18, height: 18, marginRight: 12 },
    suggestionText: { fontSize: 16, fontFamily: FONT },

    recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 16 },
    recentTitle: { fontSize: 22, fontWeight: "700", fontFamily: FONT, letterSpacing: -0.4 },
    clearText: { fontSize: 16, fontWeight: "500", fontFamily: FONT },
    recentList: { flexDirection: "column" },
    recentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
    recentArt: { width: 56, height: 56, borderRadius: 6, backgroundColor: COLORS.surface },
    recentInfo: { flex: 1, marginLeft: 14, marginRight: 10 },
    recentRowTitle: { fontSize: 16, fontWeight: "600", fontFamily: FONT, marginBottom: 2 },
    recentRowSub: { fontSize: 13, fontWeight: "400", fontFamily: FONT, marginTop: 1 },
    moreIcon: { width: 18, height: 18, resizeMode: "contain" },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
    emptyState: { paddingVertical: 40, alignItems: "center" },
    emptyText: { fontSize: 16, fontFamily: FONT },

    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
    sheetHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: "center", marginTop: 10, marginBottom: 20 },
    songHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    songHeaderArt: { width: 64, height: 64, borderRadius: 8, backgroundColor: COLORS.background },
    songHeaderText: { flex: 1, marginLeft: 14 },
    songHeaderTitle: { fontSize: 17, fontWeight: "600", fontFamily: FONT },
    songHeaderArtist: { fontSize: 14, marginTop: 2, fontFamily: FONT },
    songHeaderAlbum: { fontSize: 13, marginTop: 2, fontFamily: FONT },
    sheetDivider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
    optionRow: { paddingVertical: 14, paddingHorizontal: 4 },
    optionText: { fontSize: 16, fontFamily: FONT },
  });