// src/hooks/useTheme.ts
import { useEffect, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import { useSettingsStore } from "../store/settingsStore";

// ===========================================================
// ✅ NAVBAR GLASS SETTINGS — change the glass look only here
// ===========================================================
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

  glass: GlassSettings;
  welcomeBg: string;
  popupColour: string;
  miniArtBorder: string;
  miniDivider: string;
}

const DARK_GLASS: GlassSettings = {
  distortionStrength: 40,
  frostBlur: 16,
  tintColor: 28,
  tintOpacity: 0.6,
  shadowSpread: 0,
  shadowBlur: 20,
  blurTint: "dark",
};

const LIGHT_GLASS: GlassSettings = {
  distortionStrength: 40,
  frostBlur: 16,
  tintColor: 255,
  tintOpacity: 0.7,
  shadowSpread: 0,
  shadowBlur: 20,
  blurTint: "light",
};

type AppThemeMode = "light" | "dark";

export function useTheme(): Theme {
  const themeMode = useSettingsStore((s) => s.theme);

  // ✅ Hook called directly at the top level
  const colorScheme = useColorScheme();

  // ✅ Initial value does NOT call a hook
  const [systemMode, setSystemMode] = useState<AppThemeMode>(
    colorScheme === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    // Sync when useColorScheme changes
    setSystemMode(colorScheme === "dark" ? "dark" : "light");
  }, [colorScheme]);

  useEffect(() => {
    // Also listen directly to Android/iOS appearance changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemMode(colorScheme === "dark" ? "dark" : "light");
    });

    return () => subscription.remove();
  }, []);

  const mode: AppThemeMode =
    themeMode === "system" ? systemMode : (themeMode as AppThemeMode);

  if (mode === "light") {
    return {
      mode,
      background: "#ffffff",
      surface: "#f4f4f6",
      surfaceAlt: "#e8e8ec",
      text: "#0a0a0a",
      textSecondary: "#070708",
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

      glass: LIGHT_GLASS,
      welcomeBg: "#D60017",
      popupColour: "#FFFFFF",

      miniArtBorder: "rgba(0,0,0,0.15)",
      miniDivider: "rgba(0, 0, 0, 0.27)",
    };
  }

  return {
    mode,
    background: "#000000da",
    surface: "#1c1c1e",
    surfaceAlt: "#1c1c22",
    text: "#ffffff",
    textSecondary: "#98989e",
    primary: "#f92d48",

    border: "#22222a",
    inactive: "#98989e",
    overlay: "rgba(0,0,0,0.55)",

    isDark: true,
    accent: "#f92c47",
    success: "#32D74B",
    warning: "#FFD60A",
    error: "#FF453A",
    glassTint: "dark",

    glass: DARK_GLASS,
    welcomeBg: "#D60017",
    popupColour: "#1c1c1e",

    miniArtBorder: "rgba(255,255,255,0.2)",
    miniDivider: "rgba(255,255,255,0.15)",
  };
}