// src/components/TopStatusGlass.tsx
import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { useTheme } from "../hooks/useTheme";

const DEBUG_SHOW_RED = false;

// ===========================================================
// ✅ CHANGE THE LOOK HERE
// ===========================================================
const LOOK = {
  light: {
    color: "#ffffff",
    topOpacity: 0.85,
    midOpacity: 0.45,
    fadeExtra: 65, // 👈 INCREASED from 26 to 65 (makes it spread further down)
    shadowHeight: 0, 
    shadowOpacity: 0.14,
  },
  dark: {
    color: "#000000",
    topOpacity: 0.92,
    midOpacity: 0.55,
    fadeExtra: 65, // 👈 INCREASED from 18 to 65 (makes it spread further down)
    shadowHeight: 0, 
    shadowOpacity: 0.55,
  },
};

export default function TopStatusGlass() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions(); 
  const look = theme.isDark ? LOOK.dark : LOOK.light;

  const topInset = Math.max(insets.top, 24);
  const color = DEBUG_SHOW_RED ? "#ff0000" : look.color;
  const topOpacity = DEBUG_SHOW_RED ? 1 : look.topOpacity;
  const midOpacity = DEBUG_SHOW_RED ? 1 : look.midOpacity;

  const fadeHeight = topInset + look.fadeExtra;
  const midStop = topInset / fadeHeight; 
  const totalHeight = fadeHeight + look.shadowHeight;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { height: totalHeight, width }]}
    >
      {/* wash / fade behind the status bar */}
      <Svg width={width} height={fadeHeight} style={styles.layer}>
        <Defs>
          <SvgLinearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={topOpacity} />
            <Stop offset={midStop} stopColor={color} stopOpacity={midOpacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={width}
          height={fadeHeight}
          fill="url(#topFade)"
        />
      </Svg>

      {/* extra soft shadow just under the status bar */}
      {look.shadowHeight > 0 ? (
        <Svg
          width={width}
          height={look.shadowHeight}
          style={[styles.layer, { top: topInset }]}
        >
          <Defs>
            <SvgLinearGradient id="topShadow" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor="#000000"
                stopOpacity={look.shadowOpacity}
              />
              <Stop
                offset="0.45"
                stopColor="#000000"
                stopOpacity={look.shadowOpacity * 0.35}
              />
              <Stop offset="1" stopColor="#000000" stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={width}
            height={look.shadowHeight}
            fill="url(#topShadow)"
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1100, 
    elevation: 1100, 
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});