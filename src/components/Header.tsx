// src/components/Header.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Easing,
  Image,
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
import { MenuIcon, PinSongIcon } from "../icons/Icons";
const DEFAULT_FONT = APP_FONT_FAMILY;
const PLUS_ICON = require("../../assets/icons/createplaylisticona.png");

const POPUP_WIDTH = 160;

const DEFAULT_COLORS = {
  background: "#000000",
  text: "#ffffff",
  textSecondary: "#98989e",
  primary: "#f92c47",
  surface: "#121216",
  border: "#22222a",
  popupColour: "#1c1c1e",
  isDark: true,
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

type HeaderProps = {
  title?: string;
  scrollY: Animated.Value;
  onPlusPress?: () => void;
  fontFamily?: string;
  onEditPins?: () => void;
  onEditCategories?: () => void;
  isEditing?: boolean;
  onDonePress?: () => void;
  hasPins?: boolean; // ← new
};
export default function Header({
  title = "Home",
  scrollY,
  onPlusPress,
  fontFamily = DEFAULT_FONT,
  onEditPins,
  onEditCategories,
  isEditing = false,
  onDonePress,
  hasPins = false,
}: HeaderProps) {
  const nav = useNavigation<any>();
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

  const isDark = !!COLORS.isDark;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const headerTitleTranslateY = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, -10],
    extrapolate: "clamp",
  });

  const [showMenu, setShowMenu] = useState(false);
  const dropdownScale = useRef(new Animated.Value(0.9)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const menuClosing = useRef(false);

  const hasEditPins = typeof onEditPins === "function" && hasPins;
  const hasEditCategories = typeof onEditCategories === "function";
  const hasOptionsSection = (hasEditPins || hasEditCategories) && !isEditing;

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

  const runOrNavigate = useCallback(
    (handler: (() => void) | undefined, screenName: string) => {
      closeMenu(() => {
        if (handler) {
          handler();
          return;
        }
        navigateTo(screenName);
      });
    },
    [closeMenu, navigateTo],
  );

  const dropdownBorder = COLORS.border;
  const dropdownShadow = isDark
    ? { color: "#000", opacity: 0.35, radius: 16, elevation: 0 }
    : { color: "#000", opacity: 0.12, radius: 12, elevation: 0 };

  // Text color forced to pure white/black
  const menuTextColor = isDark ? "#ffffff" : "#000000";

  // ── Menu rows (shared by Android + iOS popup) ────────────────
  const renderMenuItems = (textColor: string) => (
    <ScrollView
      style={{ maxHeight: 400 }}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Pressable
        onPress={(e) => e.stopPropagation()}
        style={{ paddingVertical: 6 }}
      >
        {hasOptionsSection && (
          <>
            {hasEditPins && !isEditing && (
              <TouchableOpacity
                style={[styles.dropdownRow, styles.dropdownRowWithIcon]}
                activeOpacity={0.7}
                onPress={() => runOrNavigate(onEditPins, "EditPins")}
              >
                <PinSongIcon size={25} color={textColor} />
                <Text
                  style={[
                    styles.dropdownLabel,
                    styles.dropdownLabelWithIcon,
                    { color: textColor },
                  ]}
                >
                  Edit Pins
                </Text>
              </TouchableOpacity>
            )}

          {hasEditCategories && !isEditing && (
  <TouchableOpacity
    style={[styles.dropdownRow, styles.dropdownRowWithIcon]}
    activeOpacity={0.7}
    onPress={() => runOrNavigate(onEditCategories, "EditCategories")}
  >
    <MenuIcon size={21} color={textColor} />
    <Text
      style={[
        styles.dropdownLabel,
        styles.dropdownLabelWithIcon,
        { color: textColor },
      ]}
    >
      Edit Categories
    </Text>
  </TouchableOpacity>
)}
            <View
              style={[styles.divider, { backgroundColor: COLORS.border }]}
            />
          </>
        )}

        <TouchableOpacity
          style={styles.dropdownRow}
          activeOpacity={0.7}
          onPress={() => closeMenu(() => navigateTo("Settings"))}
        >
          <Text style={[styles.dropdownLabel, { color: textColor }]}>
            Settings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dropdownRow}
          activeOpacity={0.7}
          onPress={() => closeMenu(() => navigateTo("Account"))}
        >
          <Text style={[styles.dropdownLabel, { color: textColor }]}>
            Account
          </Text>
        </TouchableOpacity>
      </Pressable>
    </ScrollView>
  );

  // ⬇️ Frosted glass popup (real blur on both Android + iOS) + warm tint
  const renderPopupCard = () => {
    const popupTint = isDark
      ? "rgba(214, 208, 208, 0.03)"
      : "rgba(82, 80, 80, 0)";

    return (
      <GlassBG
        radius={12}
        lightMode={!isDark}
        blurTarget={blurTargetRef}
        settings={{
          tintOpacity: isDark ? 0.02 : 0.4,
          frostBlur: 5,
          distortionStrength: 55,
        }}
        style={{ flex: 1 }}
      >
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: popupTint }]}
          pointerEvents="none"
        />
        {renderMenuItems(menuTextColor)}
      </GlassBG>
    );
  };

  return (
    <>
      <View style={styles.headerWrapper}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: COLORS.background,
              opacity: headerBgOpacity,
              borderBottomWidth: 0,
              elevation: 0,
            },
          ]}
        />

        <View style={[styles.header, { marginTop: insets.top + 10 }]}>
          <Animated.Text
            style={[
              styles.headerTitle,
              {
                color: COLORS.text,
                fontFamily,
                opacity: headerTitleOpacity,
                transform: [{ translateY: headerTitleTranslateY }],
              },
            ]}
          >
            {title}
          </Animated.Text>

          <View style={styles.headerRight}>
            {/* ✅ Done button — exits edit mode via header */}
            {isEditing && onDonePress ? (
              <TouchableOpacity
                onPress={onDonePress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ marginRight: 8 }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    color: COLORS.primary,
                    fontSize: 16,
                    fontWeight: "600",
                    fontFamily,
                  }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            ) : null}

            {onPlusPress ? (
              <GlassBG
                radius={20}
                lightMode={!isDark}
                blurTarget={blurTargetRef}
                settings={{
                  tintOpacity: isDark ? 0.15 : 0.83,
                  frostBlur: 22,
                  distortionStrength: 55,
                }}
                style={{
                  width: 40,
                  height: 40,
                  marginLeft: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TouchableOpacity
                  onPress={onPlusPress}
                  style={{
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={PLUS_ICON}
                    style={[styles.plusIconImage, { tintColor: COLORS.text }]}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                </TouchableOpacity>
              </GlassBG>
            ) : null}

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
                width: 40,
                height: 40,
                marginLeft: 8,
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
                <MoreIcon size={22} color={COLORS.text} />
              </TouchableOpacity>
            </GlassBG>
          </View>
        </View>
      </View>

      <Modal
        visible={showMenu}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeMenu()}
      >
        <Pressable style={styles.dropdownBackdrop} onPress={() => closeMenu()}>
          <Animated.View
            style={[
              styles.dropdownCard,
              {
                top: insets.top + 50,
                right: 16,
                width: POPUP_WIDTH,
                borderColor: dropdownBorder,
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
            {/* ✅ Inner Pressable captures taps so the backdrop doesn't fire */}
            <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
              {renderPopupCard()}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "transparent",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  plusIconImage: {
    width: 21,
    height: 21,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
    elevation: 1,
  },
  dropdownCard: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    overflow: "hidden",
  },
  dropdownRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownRowWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  dropdownLabelWithIcon: {
    marginLeft: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: 12,
  },
});
