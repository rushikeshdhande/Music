// src/screens/Navigation/SearchScreen.tsx
import React, { useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "../../components/Header";
import { useTheme } from "../../hooks/useTheme";
// 👇 Import TopStatusGlass
import TopStatusGlass from "../../components/TopStatusGlass";

const FONT = "serif";

const DEFAULT_COLORS = {
  background: "#000000",
  border: "#3a3a3c",
  text: "#ffffff",
  textSecondary: "#a1a1aa",
};

export default function SearchScreen() {
  const insets = useSafeAreaInsets();

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

  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  return (
    <View style={styles.container}>
      {/* ✅ Floating transparent header */}
      <Header title="Search" scrollY={scrollY} />

      <Animated.ScrollView
        // ✅ Pushed down past status bar + header
        contentContainerStyle={[styles.content, { paddingTop: 75 + insets.top }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ✅ Duplicate title and divider removed */}

        <Text
          style={{
            color: COLORS.textSecondary,
            paddingHorizontal: 20,
            paddingTop: 16,
          }}
        >
          Coming soon... {"\n"}Search section is being updated by Rushikesh.</Text>

        <View style={{ height: 500 }} />
      </Animated.ScrollView>

      {/* 👇 Added TopStatusGlass overlay for the edge-to-edge fade */}
      <TopStatusGlass />
    </View>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    
    // ✅ Adjusted to sit cleanly below the floating header
    content: { paddingTop: 105 },
  });