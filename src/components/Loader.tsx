// src/components/Loader.tsx
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Text,
  ViewStyle,
  StyleProp,
} from "react-native";
import { useTheme } from "../hooks/useTheme";

// ── Circular Rotating Loader ───────────────────────────────────────────────
export const CircularLoader = ({
  color,
  size = 36,
  thickness = 3,
}: {
  color?: string;
  size?: number;
  thickness?: number;
}) => {
  const theme = useTheme();
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const loaderColor = color || theme.primary;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thickness,
        borderColor: loaderColor,
        borderTopColor: "transparent",
        transform: [{ rotate: spin }],
      }}
    />
  );
};

// ── Inline Loader (just the spinner) ───────────────────────────────────────
export function InlineLoader({
  style,
  color,
  size,
}: {
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: number;
}) {
  return (
    <View style={[{ alignItems: "center", justifyContent: "center" }, style]}>
      <CircularLoader color={color} size={size} />
    </View>
  );
}

// ── Screen Loader — centered overlay, transparent background ──────────────
export function ScreenLoader({
  visible,
  label,
  color,
  size = 36,
  blocker = false,
}: {
  visible: boolean;
  label?: string;
  color?: string;
  size?: number;
  blocker?: boolean;
}) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <View
      pointerEvents={blocker ? "auto" : "none"}
      style={styles.screenOverlay}
    >
      <View style={styles.loaderContainer}>
        <CircularLoader color={color || theme.primary} size={size} />
        {label ? (
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Full-Screen Loader — dims entire screen, transparent loader bg ────────
export function FullScreenLoader({
  visible,
  label,
  color,
  size = 36,
  backdrop = "rgba(0,0,0,0.4)",
}: {
  visible: boolean;
  label?: string;
  color?: string;
  size?: number;
  backdrop?: string;
}) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.fullOverlay]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: backdrop }]} />
      <View style={styles.loaderContainer}>
        <CircularLoader color={color || theme.primary} size={size} />
        {label ? (
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  fullOverlay: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  // ✅ No background color, no border
  loaderContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
    fontWeight: "500",
  },
});

export default ScreenLoader;