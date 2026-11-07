// src/hooks/useTheme.ts
import { useColorScheme } from "react-native";
import { useSettingsStore } from "../store/settingsStore";

export interface GlassSettings {
  distortionStrength: number;
  frostBlur: number;
  tintColor: number;
  tintOpacity: number;
  shadowSpread: number;
  shadowBlur: number;
  blurTint: "light" | "dark";
}

export interface Theme {
  mode: "light" | "dark";
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  primary: string;
  border: string;
  inactive: string;
  overlay: string;

  isDark: boolean;
  accent: string;
  success: string;
  warning: string;
  error: string;
  glassTint: "light" | "dark" | "default";

  welcomeBg: string;
  popupColour: string;

  miniArtBorder: string;
  miniDivider: string;

  // ✅ NEW: used by GlassCard, Header, RootNavigator, MiniPlayer
  glass: GlassSettings;
  // ✅ NEW: used by Loader, AlbumDetails, Artists, Songs, Album screens
  iconsColour: string;
}

const DEFAULT_GLASS_DARK: GlassSettings = {
  distortionStrength: 40,
  frostBlur: 15,
  tintColor: 25,
  tintOpacity: 0,
  shadowSpread: 0,
  shadowBlur: 20,
  blurTint: "dark",
};

const DEFAULT_GLASS_LIGHT: GlassSettings = {
  distortionStrength: 40,
  frostBlur: 20,
  tintColor: 245,
  tintOpacity: 0.7,
  shadowSpread: 0,
  shadowBlur: 20,
  blurTint: "light",
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.theme);
  const mode: "light" | "dark" =
    themeMode === "system"
      ? scheme === "light"
        ? "light"
        : "dark"
      : themeMode;

  if (mode === "light") {
    return {
      mode,
      background: "#ffffff",
      surface: "#f4f4f6",
      surfaceAlt: "#e8e8ec",
      text: "#0a0a0a",
      textSecondary: "#6a6a70",
      primary: "#f92c47",
      border: "#e0e0e4",
      inactive: "#98989e",
      overlay: "rgba(0,0,0,0.35)",

      isDark: false,
      accent: "#f92c47",
      success: "#34C759",
      warning: "#FF9500",
      error: "#FF3B30",
      glassTint: "light",

      welcomeBg: "#D60017",
      popupColour: "#FFFFFF",

      miniArtBorder: "rgba(0,0,0,0.15)",
      miniDivider: "rgba(0, 0, 0, 0.27)",

      glass: DEFAULT_GLASS_LIGHT,
      iconsColour: "#cacaca",
    };
  }

  return {
    mode,
    background: "#000000da",
    surface: "#121216",
    surfaceAlt: "#1c1c22",
    text: "#ffffff",
    textSecondary: "#98989e",
    primary: "#f92c47",
    border: "#22222a",
    inactive: "#98989e",
    overlay: "rgba(0,0,0,0.55)",

    isDark: true,
    accent: "#f92c47",
    success: "#32D74B",
    warning: "#FFD60A",
    error: "#FF453A",
    glassTint: "dark",

    welcomeBg: "#D60017",
    popupColour: "#1c1c1e",

    miniArtBorder: "rgba(255,255,255,0.2)",
    miniDivider: "rgba(255,255,255,0.15)",

    glass: DEFAULT_GLASS_DARK,
    iconsColour: "#e7e4e4",
  };
}