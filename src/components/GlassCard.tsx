// src/components/GlassCard.tsx
import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import * as ExpoBlur from "expo-blur";
import { useTheme } from "../hooks/useTheme";
import type { GlassSettings } from "../hooks/useTheme";

const BlurView = ExpoBlur.BlurView;
const BlurTargetView: React.ComponentType<any> | undefined = (ExpoBlur as any)
  .BlurTargetView;

/* ────────────────────────────────────────────────────────────
   clamp helper
   ──────────────────────────────────────────────────────────── */
function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/* ────────────────────────────────────────────────────────────
   The Default Glass Settings you requested
   ──────────────────────────────────────────────────────────── */
export const DEFAULT_GLASS: GlassSettings = {
  distortionStrength: 40,
  frostBlur: 20,
  tintColor: 25,       // Very dark gray
  tintOpacity: 0.85,   // High opacity
  shadowSpread: 0,
  shadowBlur: 20,
  blurTint: "dark",
};

/* ────────────────────────────────────────────────────────────
   DerivedGlass — the shape every consumer uses.
   ──────────────────────────────────────────────────────────── */
export type DerivedGlass = {
  distortion: number;
  frostBlur: number;
  gray: number;
  tintOpacity: number;
  shadowSpread: number;
  shadowBlur: number;
  blurIntensity: number;
  blurTint: "light" | "dark";
  borderColor: string;
  shadowColor: string;
  backgroundColor: string;
};

/* ────────────────────────────────────────────────────────────
   deriveGlass — turns a GlassSettings + isDark into every
   visual value used by the card / navbar / popup.
   ──────────────────────────────────────────────────────────── */
export function deriveGlass(
  glass: GlassSettings,
  isDark: boolean,
): DerivedGlass {
  const distortion = clamp(glass.distortionStrength, 0, 100);
  const frostBlur = clamp(glass.frostBlur, 0, 30);
  const gray = Math.round(clamp(glass.tintColor, 0, 255));
  const tintOpacity = clamp(glass.tintOpacity, 0, 1);
  const shadowSpread = clamp(glass.shadowSpread, -55, 55);
  const shadowBlur = clamp(glass.shadowBlur, 0, 50);

  const borderColor = isDark
    ? `rgba(255,255,255,${0.08 + (distortion / 100) * 0.3})`
    : `rgba(0,0,0,${0.06 + (distortion / 100) * 0.12})`;

  const shadowColor = isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.18)";

  return {
    distortion,
    frostBlur,
    gray,
    tintOpacity,
    shadowSpread,
    shadowBlur,
    blurIntensity: (frostBlur / 30) * 100,
    blurTint: glass.blurTint,
    borderColor,
    shadowColor,
    backgroundColor: `rgba(${gray},${gray},${gray},${tintOpacity})`,
  };
}

/* ────────────────────────────────────────────────────────────
   GlassBG — A simple component you can drop ANYWHERE to get
   the exact glass background effect (like the MiniPlayer).

   ✅ FIX: now uses the THEME's glass settings (theme.glass),
   which is the SAME source as the root navbar / MiniPlayer, so
   the header pills and the dropdown popup match the navbar look.

   Pass `settings` to override any value per-instance.
   ──────────────────────────────────────────────────────────── */
type GlassBGProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  lightMode?: boolean; // Pass true to automatically use light glass
  blurTarget?: React.RefObject<any>;
  settings?: Partial<GlassSettings>; // Override any settings if needed
};

export function GlassBG({
  children,
  style,
  radius = 0,
  lightMode = false,
  blurTarget,
  settings,
}: GlassBGProps) {
  const theme = useTheme();
  const innerTargetRef = React.useRef<any>(null);
  const target = blurTarget ?? innerTargetRef;

  const themeGlass: GlassSettings =
    (theme && (theme as any).glass) || DEFAULT_GLASS;

  const baseSettings: GlassSettings = lightMode
    ? {
        ...themeGlass,
        tintColor: 245,
        tintOpacity: 0.7,
        blurTint: "light" as const,
      }
    : themeGlass;

  const finalSettings: GlassSettings = {
    ...baseSettings,
    ...(settings ?? {}),
  };

  const g = deriveGlass(finalSettings, !lightMode);

  // Pills (radius > 0) get an always-visible solid base under the blur,
  // so the small header icon buttons are visible even when BlurView has
  // nothing (flat colour) to sample behind them.
  const isPill = radius > 0;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: isPill
            ? lightMode
              ? "rgba(245,245,245,0.85)"
              : "rgba(29,29,29,0.65)"
            : "transparent",
          ...(isPill && {
            borderWidth: 1,
            borderColor: g.borderColor,
            boxShadow: [
              {
                offsetX: 0,
                offsetY: -8,
                blurRadius: g.shadowBlur,
                spreadDistance: g.shadowSpread,
                color: g.shadowColor,
              },
            ] as any,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: !lightMode ? 0.28 : 0.18,
            shadowRadius: g.shadowBlur,
            elevation: 18,
          }),
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, overflow: "hidden" },
        ]}
      >
        {BlurTargetView && !blurTarget && (
          <BlurTargetView
            ref={innerTargetRef}
            collapsable={false}
            style={StyleSheet.absoluteFill}
          >
            <View style={{ flex: 1 }} />
          </BlurTargetView>
        )}

        {g.frostBlur > 0 && (
          <BlurView
            intensity={g.blurIntensity}
            tint={g.blurTint}
            {...({
              blurMethod: "dimezisBlurView",
              blurTarget: target,
            } as any)}
            style={StyleSheet.absoluteFill}
          />
        )}

        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: g.backgroundColor },
          ]}
        />
      </View>

      {children}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────
   GlassCard — The original component, updated to fallback
   to your requested DEFAULT_GLASS if theme doesn't have it.
   ──────────────────────────────────────────────────────────── */
type Props = {
  children?: React.ReactNode;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
  blurTarget?: React.RefObject<any>;
};

export default function GlassCard({
  children,
  radius = 16,
  style,
  blurTarget,
}: Props) {
  const theme = useTheme();
  const { isDark } = theme;

  // Use the exact requested settings if theme doesn't provide custom ones
  const glass = theme.glass ?? DEFAULT_GLASS;
  const g = deriveGlass(glass, isDark);

  const innerTargetRef = React.useRef<any>(null);
  const target = blurTarget ?? innerTargetRef;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: g.borderColor,
          overflow: "hidden",
          boxShadow: [
            {
              offsetX: 0,
              offsetY: -8,
              blurRadius: g.shadowBlur,
              spreadDistance: g.shadowSpread,
              color: g.shadowColor,
            },
          ] as any,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: isDark ? 0.28 : 0.18,
          shadowRadius: g.shadowBlur,
          elevation: 18,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, overflow: "hidden" },
        ]}
      >
        {BlurTargetView && !blurTarget && (
          <BlurTargetView
            ref={innerTargetRef}
            collapsable={false}
            style={StyleSheet.absoluteFill}
          >
            <View style={{ flex: 1 }} />
          </BlurTargetView>
        )}

        {g.frostBlur > 0 && (
          <BlurView
            intensity={g.blurIntensity}
            tint={g.blurTint}
            {...({
              blurMethod: "dimezisBlurView",
              blurTarget: target,
            } as any)}
            style={StyleSheet.absoluteFill}
          />
        )}

        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: g.backgroundColor },
          ]}
        />
      </View>

      {children}
    </View>
  );
}