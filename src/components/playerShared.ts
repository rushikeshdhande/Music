// src/components/playerShared.ts
//
// Font helpers shared by MiniPlayer.tsx and Fullscreen.tsx.
import { Platform, TextStyle } from "react-native";

export const SF = {
  regular: Platform.select({ ios: "System", default: "sans-serif" }),
  medium: Platform.select({ ios: "System", default: "sans-serif-medium" }),
  semibold: Platform.select({ ios: "System", default: "sans-serif-medium" }),
  bold: Platform.select({ ios: "System", default: "sans-serif" }),
};
export const iosWeight = (w: TextStyle["fontWeight"]): TextStyle =>
  Platform.OS === "ios" ? { fontWeight: w } : {};

export const sfFont = (
  family: string | undefined,
  w: TextStyle["fontWeight"],
): TextStyle => {
  if (Platform.OS === "ios") return { fontFamily: family, fontWeight: w };
  const heavy = w === "700" || w === "800" || w === "900" || w === "bold";
  return heavy
    ? { fontFamily: family, fontWeight: "bold" }
    : { fontFamily: family };
};