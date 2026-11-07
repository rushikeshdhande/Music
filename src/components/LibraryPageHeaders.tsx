// src/components/LibraryPageHeaders.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Pressable,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../hooks/useTheme";
import { showToast } from "../utils/toast";
import { APP_FONT_FAMILY } from "../utils/globalFont";
import { GlassBG } from "./GlassCard";
import { blurTargetRef } from "../navigation/blurTarget";

const BACK_ICON = require("../../assets/icons/backicon.png");
const FONT = APP_FONT_FAMILY || "sans-serif";

const DEFAULT_COLORS = {
  background: "#1c1c1e",
  surface: "#434446",
  border: "#3f4042",
  text: "#ffffff",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  primary: "#f92c47",
  isDark: true,
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

const MoreIcon = ({
  size = 22,
  color = "#000",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fill={color}
      d="M12 3C10.9 3 10 3.9 10 5C10 6.1 10.9 7 12 7C13.1 7 14 6.1 14 5C14 3.9 13.1 3 12 3ZM12 17C10.9 17 10 17.9 10 19C10 20.1 10.9 21 12 21C13.1 21 14 20.1 14 19C14 17.9 13.1 17 12 17ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
    />
  </Svg>
);

// ── Types ──────────────────────────────────────────────────────────────
export type HeaderAction = {
  key?: string;
  icon?: any;
  isText?: boolean;
  text?: string;
  iconStyle?: any;
  onPress: () => void;
};

export type MenuItem = {
  key?: string;
  label: string;
  onPress?: () => void;
  screenName?: string; // fallback navigation target
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
  // 👇 ⋮ dropdown menu items (optional)
  menuItems?: MenuItem[];
  // 👇 convenience: auto-add Settings/Account entries
  showDefaultMenu?: boolean;
};

// ── Glass Icon Button (translucent circle, no blur) ───────────────────
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

  // 1. Strip any tintColor from iconStyle so it doesn't override theme
  const safeIconStyle = { ...(iconStyle || {}) };
  delete safeIconStyle.tintColor;

  // 2. Force theme color (white for dark, black for light)
  const iconColor = isDark ? "#ffffff" : "#000000";
  const iconSize = safeIconStyle.width || 18;

  // 3. Render Text, SVG components, React elements, or PNG images
  const renderContent = () => {
    if (isText) {
      return (
        <Text style={[styles.glassIconText, { color: iconColor }]}>
          {text}
        </Text>
      );
    }

    if (typeof icon === "function") {
      const IconComponent = icon;
      return (
        <IconComponent color={iconColor} size={iconSize} {...safeIconStyle} />
      );
    }

    if (React.isValidElement(icon)) {
      return React.cloneElement(icon as React.ReactElement<any>, {
        color: iconColor,
        size: iconSize,
        ...safeIconStyle,
      });
    }

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

// ── Glass Menu Button (⋮) with GlassBG dropdown ───────────────────────
const GlassMenuButton = ({
  colors,
  menuItems = [],
  showDefaultMenu = false,
}: {
  colors: any;
  menuItems?: MenuItem[];
  showDefaultMenu?: boolean;
}) => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const C = colors || DEFAULT_COLORS;
  const isDark = useMemo(() => deriveIsDark(C), [C]);
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const [showMenu, setShowMenu] = useState(false);
  const dropdownScale = useRef(new Animated.Value(0.9)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const menuClosing = useRef(false);

  useEffect(() => {
    if (!showMenu) return;
    menuClosing.current = false;
    dropdownScale.setValue(0.9);
    dropdownOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(dropdownScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dropdownOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [showMenu, dropdownScale, dropdownOpacity]);

  const closeMenu = useCallback(
    (after?: () => void) => {
      if (menuClosing.current) return;
      menuClosing.current = true;
      Animated.parallel([
        Animated.timing(dropdownScale, {
          toValue: 0.94,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dropdownOpacity, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        menuClosing.current = false;
        setShowMenu(false);
        after?.();
      });
    },
    [dropdownScale, dropdownOpacity],
  );

  const navigateTo = useCallback(
    (name: string): boolean => {
      let n: any = nav;
      while (n) {
        const names: string[] | undefined = n.getState?.()?.routeNames;
        if (names && names.includes(name)) {
          n.navigate(name);
          return true;
        }
        n = n.getParent?.();
      }
      showToast(`"${name}" screen is not registered in the navigator`);
      return false;
    },
    [nav],
  );

  const handleItem = useCallback(
    (item: MenuItem) => {
      closeMenu(() => {
        if (item.onPress) {
          item.onPress();
          return;
        }
        if (item.screenName) {
          navigateTo(item.screenName);
        }
      });
    },
    [closeMenu, navigateTo],
  );

  const items: MenuItem[] = useMemo(() => {
    const base = [...menuItems];
    if (showDefaultMenu) {
      if (base.length > 0) base.push({ key: "__divider__", label: "" });
      base.push({ key: "settings", label: "Settings", screenName: "Settings" });
      base.push({ key: "account", label: "Account", screenName: "Account" });
    }
    return base;
  }, [menuItems, showDefaultMenu]);

  const dropdownShadow = isDark
    ? { color: "#000", opacity: 0.35, radius: 16, elevation: 18 }
    : { color: "#000", opacity: 0.12, radius: 12, elevation: 6 };

  return (
    <>
      {/* ── ⋮ trigger button — glass WITH settings (matches Header.tsx) ── */}
      <GlassBG
        radius={20}
        lightMode={!isDark}
        blurTarget={blurTargetRef}
        settings={{
          tintOpacity: isDark ? 0.35 : 0.55,
          frostBlur: 22,
          distortionStrength: 55,
        }}
        style={{
          width: 38,
          height: 38,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => setShowMenu(true)}
          style={{
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <MoreIcon size={20} color={isDark ? "#fff" : "#000"} />
        </TouchableOpacity>
      </GlassBG>

      {/* ── Dropdown popup modal ── */}
      <Modal
        visible={showMenu}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeMenu()}
      >
        <Pressable style={styles.dropdownBackdrop} onPress={() => closeMenu()}>
          {/* Outer Animated.View: animation + shadow ONLY — no backgroundColor */}
          <Animated.View
            style={[
              styles.dropdownCard,
              {
                top: insets.top + 50,
                right: 16,
                borderColor: C.border,
                opacity: dropdownOpacity,
                transform: [{ scale: dropdownScale }],
                transformOrigin: "top right",
                shadowColor: dropdownShadow.color,
                shadowOpacity: dropdownShadow.opacity,
                shadowRadius: dropdownShadow.radius,
                elevation: dropdownShadow.elevation,
              } as any,
            ]}
          >
            {/* ✅ Popup GlassBG — settings force a solid tint so it works
                inside <Modal> on Android (BlurView can't sample blurTargetRef
                across the Modal's native window boundary). On iOS the BlurView
                still works and blurTarget={blurTargetRef} gives the real
                frosted look. This matches Header.tsx exactly. */}
            <GlassBG
              radius={12}
              lightMode={!isDark}
              blurTarget={blurTargetRef}
              settings={{
                tintOpacity: isDark ? 0.85 : 0.9,
                frostBlur: 20,
                distortionStrength: 40,
              }}
              style={{ flex: 1 }}
            >
              <ScrollView
                style={{ maxHeight: 400 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Pressable onPress={(e) => e.stopPropagation()}>
                  {items.map((item, i) => {
                    if (item.key === "__divider__") {
                      return (
                        <View
                          key={`divider_${i}`}
                          style={[
                            styles.divider,
                            { backgroundColor: C.border },
                          ]}
                        />
                      );
                    }
                    return (
                      <TouchableOpacity
                        key={item.key || `item_${i}`}
                        style={styles.dropdownRow}
                        activeOpacity={0.7}
                        onPress={() => handleItem(item)}
                      >
                        <Text
                          style={[styles.dropdownLabel, { color: C.text }]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </Pressable>
              </ScrollView>
            </GlassBG>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
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
  menuItems,
  showDefaultMenu = false,
}: Props) {
  // Merge theme + user colors + defaults
  const themeRaw = useTheme() as any;
  const base =
    themeRaw && typeof themeRaw === "object" && themeRaw.background
      ? themeRaw
      : themeRaw?.colors && typeof themeRaw.colors === "object"
        ? themeRaw.colors
        : themeRaw?.theme && typeof themeRaw.theme === "object"
          ? themeRaw.theme
          : {};

  const C = useMemo(
    () => ({ ...DEFAULT_COLORS, ...base, ...(colors || {}) }),
    [base, colors],
  );
  const isDark = useMemo(() => deriveIsDark(C), [C]);
  const styles = useMemo(() => createStyles(C, isDark), [C, isDark]);

  const hasTitle = !!(title && title.trim());
  const hasMenu = showDefaultMenu || (menuItems && menuItems.length > 0);

  // Right-hand: custom actions + optional ⋮ menu
  const renderRight = () => (
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
      {hasMenu && (
        <GlassMenuButton
          colors={C}
          menuItems={menuItems}
          showDefaultMenu={showDefaultMenu}
        />
      )}
    </View>
  );

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
        {renderRight()}
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
        {renderRight()}
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

    // ── GlassIconBtn (translucent circle, no blur) ──
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

    // ── Title + search ──
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

    // ── Dropdown modal ──
    dropdownBackdrop: {
      flex: 1,
      backgroundColor: "transparent",
    },
    dropdownCard: {
      position: "absolute",
      width: 200,
      borderRadius: 12,
      // ⚠️ NO backgroundColor — GlassBG draws it
      borderWidth: StyleSheet.hairlineWidth,
      shadowOffset: { width: 0, height: 8 },
      overflow: "hidden", // clips blur to rounded corners
    },
    dropdownRow: {
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    dropdownLabel: {
      fontSize: 15,
      fontWeight: "500",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginVertical: 6,
      marginHorizontal: 10,
    },
  });