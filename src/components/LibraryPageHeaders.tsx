// src/components/LibraryPageHeaders.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
} from "react-native";

const BACK_ICON = require("../../assets/icons/backicon.png");
const FONT = "sans-serif";

const DEFAULT_COLORS = {
  background: "#1c1c1e",
  surface: "#434446",
  border: "#3f4042",
  text: "#ffffff",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  primary: "#f92c47",
};

// ── Helpers ────────────────────────────────────────────────────────────
const isLightHex = (raw: string | null | undefined): boolean => {
  if (!raw || typeof raw !== "string") return false;
  let h = raw.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55;
};

const deriveIsDark = (C: any): boolean => {
  if (typeof C?.isDark === "boolean") return C.isDark;
  if (C?.mode === "light") return false;
  if (C?.mode === "dark") return true;
  return !isLightHex(C?.background ?? C?.surface);
};

// ── Types ──────────────────────────────────────────────────────────────
export type HeaderAction = {
  key?: string;
  icon?: any;
  isText?: boolean;
  text?: string;
  iconStyle?: any;
  onPress: () => void;
};

type Props = {
  colors?: any;
  topInset?: number;
  showBack?: boolean;
  onBack?: () => void;
  actions?: HeaderAction[];
  title: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
  transparent?: boolean;
};

// ── Glass Icon Button ─────────────────────────────────────────────────
export const GlassIconBtn = ({
  icon,
  onPress,
  isText,
  text,
  iconStyle,
  colors,
}: any) => {
  const C = colors || DEFAULT_COLORS;
  const isDark = useMemo(() => deriveIsDark(C), [C]);
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  // 👇 1. Strip out any tintColor from iconStyle to ensure it doesn't override our theme
  const safeIconStyle = { ...(iconStyle || {}) };
  delete safeIconStyle.tintColor;

  // 👇 2. Force the theme color (White for Dark Mode, Black for Light Mode)
  const iconColor = isDark ? "#ffffff" : "#000000";
  const iconSize = safeIconStyle.width || 18;

  // 👇 3. Safely render Text, SVG Components, React Elements, or PNG Images
  const renderContent = () => {
    if (isText) {
      return <Text style={[styles.glassIconText, { color: iconColor }]}>{text}</Text>;
    }
    
    // Handle custom SVG components passed as functions (e.g., ShareSvg)
    if (typeof icon === "function") {
      const IconComponent = icon;
      return <IconComponent color={iconColor} size={iconSize} {...safeIconStyle} />;
    }
    
    // Handle JSX passed directly
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon as React.ReactElement<any>, { 
        color: iconColor, 
        size: iconSize, 
        ...safeIconStyle 
      });
    }

    // Handle regular PNG Images (require)
    return (
      <Image
        source={icon}
        style={[styles.glassIconImg, safeIconStyle, { tintColor: iconColor }]}
        resizeMode="contain"
      />
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.glassIconBtn}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

// ── Library Page Header ───────────────────────────────────────────────
export default function LibraryPageHeaders({
  colors,
  topInset = 0,
  showBack = true,
  onBack,
  actions = [],
  title,
  showSearch = true,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search",
  transparent = false,
}: Props) {
  const C = useMemo(() => ({ ...DEFAULT_COLORS, ...(colors || {}) }), [colors]);
  const isDark = useMemo(() => deriveIsDark(C), [C]);
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const hasTitle = !!(title && title.trim());

  if (transparent) {
    return (
      <View
        pointerEvents="box-none"
        style={[styles.floatingBar, { paddingTop: topInset + 8 }]}
      >
        {showBack ? (
          <GlassIconBtn
            colors={C}
            icon={BACK_ICON}
            iconStyle={{ width: 16, height: 16 }}
            onPress={onBack || (() => {})}
          />
        ) : (
          <View style={{ width: 38 }} />
        )}

        <View style={styles.topRight}>
          {actions.map((a, i) => (
            <GlassIconBtn
              key={a.key || `action_${i}`}
              colors={C}
              icon={a.icon}
              isText={a.isText}
              text={a.text}
              iconStyle={a.iconStyle}
              onPress={a.onPress}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        {showBack ? (
          <GlassIconBtn
            colors={C}
            icon={BACK_ICON}
            iconStyle={{ width: 16, height: 16 }}
            onPress={onBack || (() => {})}
          />
        ) : (
          <View style={{ width: 38 }} />
        )}

        <View style={styles.topRight}>
          {actions.map((a, i) => (
            <GlassIconBtn
              key={a.key || `action_${i}`}
              colors={C}
              icon={a.icon}
              isText={a.isText}
              text={a.text}
              iconStyle={a.iconStyle}
              onPress={a.onPress}
            />
          ))}
        </View>
      </View>

      {(hasTitle || showSearch) && (
        <View style={styles.stickyHeader}>
          {hasTitle ? <Text style={styles.title}>{title}</Text> : null}

          {showSearch && (
            <View style={styles.searchWrap}>
              <TextInput
                value={searchValue}
                onChangeText={onSearchChange}
                placeholder={searchPlaceholder}
                placeholderTextColor={C.textSecondary}
                style={styles.searchInput}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={C.primary}
              />
              {searchValue.length > 0 && (
                <TouchableOpacity onPress={() => onSearchChange?.("")}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const createStyles = (C: any, isDark: boolean) =>
  StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 8,
    },

    floatingBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      elevation: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 8,
    },

    topRight: { flexDirection: "row", alignItems: "center", gap: 8 },

    glassIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 50,
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.12)"
        : "rgba(0, 0, 0, 0.08)",
      borderWidth: 1, 
      borderColor: isDark
        ? "rgba(255, 255, 255, 0.25)" 
        : "rgba(0, 0, 0, 0.15)",      
      alignItems: "center",
      justifyContent: "center",
    },
    glassIconImg: {
      width: 18,
      height: 18,
    },
    glassIconText: {
      fontSize: 20,
      lineHeight: 22,
      fontWeight: "400",
      textAlign: "center",
      textAlignVertical: "center",
      marginTop: -2,
    },

    stickyHeader: {
      backgroundColor: C.background,
      zIndex: 10,
    },
    title: {
      color: C.text,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.5,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      fontFamily: FONT,
      marginLeft: 4,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: C.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      height: 49,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    searchInput: {
      flex: 1,
      color: C.text,
      fontSize: 16,
      paddingVertical: 0,
      fontFamily: FONT,
    },
    clearIcon: { color: C.textMuted, fontSize: 14, paddingLeft: 8 },
  });