// src/navigation/RootNavigator.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigationState,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Linking,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenOrientation from "expo-screen-orientation";
import * as ExpoBlur from "expo-blur"; // npx expo install expo-blur

import { playerExpansionShared } from "./playerAnimation";
import { navigationRef } from "./navigationService";
import { RootStackParamList, TabParamList } from "./types";

// ✅ nav icons (NewIcon removed — replaced with grid.png)
import { RadioIcon, SearchIcon } from "../icons/Icons";

import HomeScreen from "../screens/Navigation/HomeScreen";
import NewScreen from "../screens/Navigation/Newscreen";
import RadioScreen from "../screens/Navigation/Redioscreen";
import SearchScreen from "../screens/Navigation/SearchScreen";
import SongsScreen from "../screens/SongsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import QueueScreen from "../screens/QueueScreen";
import FavouriteSongsScreen from "../screens/FavouriteSongsScreen";
import PlaylistsScreen from "../screens/PlaylistsScreen";
import PlaylistDetailsScreen from "../screens/PlaylistDetailsScreen";
import LibraryScreen from "../screens/Navigation/LibraryScreen";
import AccountScreen from "../screens/AccountScreen";
import MusicVideosScreen from "../screens/MusicVideosScreen";
import AlbumScreen from "../screens/AlbumScreen";
import AlbumDetailsScreen from "../screens/AlbumDetailsScreen";
import ArtistsScreen from "../screens/ArtistsScreen";
import ArtistDetailsScreen from "../screens/ArtistDetailsScreen";

import MiniPlayer from "../components/MiniPlayer";
import TopStatusGlass from "../components/TopStatusGlass";
import VideoPlayerHost from "../components/VideoPlayerHost";

import { useTheme } from "../hooks/useTheme";
import { useSettingsStore } from "../store/settingsStore";
import { useMediaStore } from "../store/mediaStore";
import { MUSIC_VIDEOS } from "../data/musicVideos";
import { useVideoStore } from "../store/videoStore";

void SplashScreen.preventAutoHideAsync().catch(() => {});

// expo-blur: BlurView works everywhere. On Android, expo-blur SDK 54+ also
// needs BlurTargetView (the content that gets blurred). It is read safely
// here, so older SDKs (where it does not exist) still work.
const BlurView = ExpoBlur.BlurView;
const BlurTargetView: React.ComponentType<any> | undefined = (ExpoBlur as any)
  .BlurTargetView;

// NOTE: the navbar glass settings now live in the theme file
// (src/hooks/useTheme.ts → theme.glass). Change the glass look there.

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Navbar height is written ONLY in styles.barRow (bottom of this file).
// This helper reads it from there so there is one place to change it.
function getNavbarHeight(): number {
  return (StyleSheet.flatten(styles.barRow).height as number) ?? 56;
}

// Bottom margin is also written ONLY in styles.barRow (`bottom`).
function getNavbarBottomMargin(): number {
  return (StyleSheet.flatten(styles.barRow).bottom as number) ?? 0;
}

export function useGlassTabBarSpace() {
  const insets = useSafeAreaInsets();
  return getNavbarHeight() + getNavbarBottomMargin() + insets.bottom + 12;
}

// ── tab icons ──────────────────────────────────────────────
const HOME_ICON_PNG = require("../../assets/icons/home.png");
const LIBRARY_ICON_PNG = require("../../assets/images/library.png");
const GRID_ICON_PNG = require("../../assets/images/grid.png"); // ✅ NEW icon

// ===========================================================
// ✅ PER-TAB STYLE CONFIG — manually adjust each one
// ===========================================================
type NavItemStyle = {
  size: number;
  gap: number;
  marginTop: number;
  iconMarginBottom?: number; // new: space under the icon
  labelMarginBottom?: number; // new: space under the label
  paddingTop: number;
  paddingBottom: number;
  labelSize: number;
};
const HOME_STYLE: NavItemStyle = {
  size: 26.5,
  gap: 0,
  marginTop: 0,
  paddingTop: 0,
  paddingBottom: 0,
  labelSize: 11,
};

const NEW_STYLE: NavItemStyle = {
  size: 21,
  gap: -1,
  marginTop: 4,
  paddingTop: 0,
  paddingBottom: 0,
  labelSize: 11,
};

const RADIO_STYLE: NavItemStyle = {
  size: 35,
  gap: 0,
  marginTop: -3,
  iconMarginBottom: 0,
  labelMarginBottom: 8,
  paddingTop: 0,
  paddingBottom: 0,
  labelSize: 11,
};

const LIBRARY_STYLE: NavItemStyle = {
  size: 25,
  gap: 0,
  marginTop: 0,
  paddingTop: 0,
  paddingBottom: 0,
  labelSize: 11,
};

const SEARCH_STYLE: NavItemStyle = {
  size: 23,
  gap: 1,
  marginTop: 0,
  paddingTop: 0,
  paddingBottom: 0,
  labelSize: 11,
};

// ✅ Nav items: Home → New → Radio → Library → Search
type NavItemName = "Home" | "New" | "Radio" | "Library" | "Search";

const TAB_ITEMS: {
  name: NavItemName;
  label: string;
  tabIndex: number;
  style: NavItemStyle;
  icon: (color: string, size: number) => React.ReactNode;
}[] = [
  {
    name: "Home",
    label: "Home",
    tabIndex: 0,
    style: HOME_STYLE,
    icon: (c, s) => (
      <Image
        source={HOME_ICON_PNG}
        style={{ width: s, height: s, tintColor: c }}
        resizeMode="contain"
        fadeDuration={0} // ✅ Instant show
      />
    ),
  },
  {
    name: "New",
    label: "New",
    tabIndex: 1,
    style: NEW_STYLE,
    icon: (c, s) => (
      <Image
        source={GRID_ICON_PNG}
        style={{ width: s, height: s, tintColor: c }}
        resizeMode="contain"
        fadeDuration={0} // ✅ Instant show
      />
    ),
  },
  {
    name: "Radio",
    label: "Radio",
    tabIndex: 2,
    style: RADIO_STYLE,
    icon: (c, s) => <RadioIcon size={s} color={c} />,
  },
  {
    name: "Library",
    label: "Library",
    tabIndex: 3,
    style: LIBRARY_STYLE,
    icon: (c, s) => (
      <Image
        source={LIBRARY_ICON_PNG}
        style={{ width: s, height: s, tintColor: c }}
        resizeMode="contain"
        fadeDuration={0} // ✅ Instant show
      />
    ),
  },
  {
    name: "Search",
    label: "Search",
    tabIndex: 4,
    style: SEARCH_STYLE,
    icon: (c, s) => <SearchIcon size={s} color={c} />,
  },
];

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const LibraryStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const NewStack = createNativeStackNavigator();
const RadioStack = createNativeStackNavigator();
const SearchStack = createNativeStackNavigator();

// ---------------------------------------------------------------------------
// Home tab stack
// ---------------------------------------------------------------------------
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator id="HomeStack" screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen
        name="Songs"
        component={SongsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <HomeStack.Screen
        name="Albums"
        component={AlbumScreen}
        options={{ animation: "slide_from_right" }}
      />
      <HomeStack.Screen
        name="AlbumDetails"
        component={AlbumDetailsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <HomeStack.Screen
        name="FavouriteSongs"
        component={FavouriteSongsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <HomeStack.Screen
        name="MusicVideos"
        component={MusicVideosScreen}
        options={{ animation: "slide_from_right" }}
      />
      <HomeStack.Screen
        name="Artists"
        component={ArtistsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <HomeStack.Screen
        name="ArtistDetails"
        component={ArtistDetailsScreen}
        options={{ animation: "slide_from_right" }}
      />
    </HomeStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// New tab stack
// ---------------------------------------------------------------------------
function NewStackNavigator() {
  return (
    <NewStack.Navigator id="NewStack" screenOptions={{ headerShown: false }}>
      <NewStack.Screen name="NewMain" component={NewScreen} />
    </NewStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Radio tab stack
// ---------------------------------------------------------------------------
function RadioStackNavigator() {
  return (
    <RadioStack.Navigator
      id="RadioStack"
      screenOptions={{ headerShown: false }}
    >
      <RadioStack.Screen name="RadioMain" component={RadioScreen} />
    </RadioStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Search tab stack
// ---------------------------------------------------------------------------
function SearchStackNavigator() {
  return (
    <SearchStack.Navigator
      id="SearchStack"
      screenOptions={{ headerShown: false }}
    >
      <SearchStack.Screen name="SearchMain" component={SearchScreen} />
    </SearchStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Library tab stack
// ---------------------------------------------------------------------------
function LibraryStackNavigator() {
  return (
    <LibraryStack.Navigator
      id="LibraryStack"
      screenOptions={{ headerShown: false }}
    >
      <LibraryStack.Screen name="LibraryMain" component={LibraryScreen} />
      <LibraryStack.Screen
        name="Songs"
        component={SongsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <LibraryStack.Screen
        name="Albums"
        component={AlbumScreen}
        options={{ animation: "slide_from_right" }}
      />
      <LibraryStack.Screen
        name="AlbumDetails"
        component={AlbumDetailsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <LibraryStack.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <LibraryStack.Screen
        name="PlaylistDetails"
        component={PlaylistDetailsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <LibraryStack.Screen
        name="FavouriteSongs"
        component={FavouriteSongsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <LibraryStack.Screen
        name="MusicVideos"
        component={MusicVideosScreen}
        options={{ animation: "slide_from_right" }}
      />
      <LibraryStack.Screen
        name="Artists"
        component={ArtistsScreen}
        options={{ animation: "slide_from_right" }}
      />
      <LibraryStack.Screen
        name="ArtistDetails"
        component={ArtistDetailsScreen}
        options={{ animation: "slide_from_right" }}
      />
    </LibraryStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Tab bar colours
// (tab bar background colour is now written in styles.barRow)
// ---------------------------------------------------------------------------
function useTabBarColors() {
  const theme = useTheme();
  const isDark = theme.mode === "dark";

  return {
    theme,
    isDark,
    PILL_BG: isDark ? "rgba(131, 17, 17, 0.1)" : "rgba(0,0,0,0.06)",
  };
}

// ---------------------------------------------------------------------------
// Ripple + dots + tab button
// ---------------------------------------------------------------------------
const FIRST_RIPPLE_COLOR = "#7C797A";
const NORMAL_RIPPLE_COLOR = "#FF2D55";
const RIPPLE_DURATION = 550;
const NAV_DELAY = 140; // ms to wait before switching tab

// Animated Pressable keeps the existing tab layout and touch behaviour.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TabButtonProps = {
  item: (typeof TAB_ITEMS)[number];
  isActive: boolean;
  color: string;
  rippleColor: string;
  onSelect: () => void; // runs instantly on tap (colour change)
  onPress: () => void; // runs after NAV_DELAY (screen switch)
  entryProgress: { value: number };
};

function TabButton({
  item,
  isActive,
  color,
  rippleColor,
  onSelect,
  onPress,
  entryProgress,
}: TabButtonProps) {
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  // 1 = finished / hidden, 0 = just tapped
  const progress = useSharedValue(1);
  const animatedRippleColor = useSharedValue<string>(rippleColor);
  const s = item.style;

  // All five tabs share this progress, so they slide left together
  // while keeping their original parent positions and gaps.
  const entryStyle = useAnimatedStyle(() => ({
    opacity: interpolate(entryProgress.value, [0, 1], [0, 1]),
    transform: [
      {
        translateX: interpolate(
          entryProgress.value,
          [0, 1],
          [360, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const rippleStyle = useAnimatedStyle(
    (): ViewStyle => ({
      backgroundColor: animatedRippleColor.value,
      opacity: interpolate(progress.value, [0, 1], [0.4, 0]),
      transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 1]) }],
    }),
  );

  const handlePress = () => {
    // Capture this tap's colour before the parent updates for later taps.
    animatedRippleColor.value = rippleColor;
    onSelect();

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: RIPPLE_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(onPress, NAV_DELAY);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
      onPress={handlePress}
      style={[
        styles.item,
        entryStyle,
        {
          gap: s.gap,
          paddingTop: s.paddingTop,
          paddingBottom: s.paddingBottom,
        },
      ]}
    >
      {/* big ripple, centred on the whole item (icon + label) */}
      <View pointerEvents="none" style={styles.effectLayer}>
        <Animated.View
          pointerEvents="none"
          style={[styles.ripple, { backgroundColor: rippleColor }, rippleStyle]}
        />
      </View>

      {/* icon: optional bottom margin (only tabs that set it are affected) */}
      <View
        style={[styles.iconWrap, { marginBottom: s.iconMarginBottom ?? 0 }]}
      >
        {item.icon(color, s.size)}
      </View>

      {/* label: optional bottom margin (only tabs that set it are affected) */}
      <Text
        style={[
          styles.label,
          {
            color,
            fontSize: s.labelSize,
            marginTop: s.marginTop,
            marginBottom: s.labelMarginBottom ?? 0,
          },
        ]}
      >
        {item.label}
      </Text>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------
type GlassTabBarProps = {
  activeIndex: number;
  hidden: boolean;
  onPress: (name: NavItemName, tabIndex: number) => void;
  blurTarget?: React.RefObject<any>; // content that BlurView blurs (Android)
};

function GlassTabBar({
  activeIndex,
  hidden,
  onPress,
  blurTarget,
}: GlassTabBarProps) {
  const { theme, isDark } = useTabBarColors();
  const insets = useSafeAreaInsets();
  // bottom margin (styles.barRow.bottom) + safe area (home indicator)
  const bottomOffset = insets.bottom + getNavbarBottomMargin();
  const navbarHeight = getNavbarHeight();

  // One-time app-launch entrance: all navbar items move together
  // from right to left into their original positions.
  const navEntryProgress = useSharedValue(0);
  useEffect(() => {
    navEntryProgress.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [navEntryProgress]);

  // ── glass values from the theme file (clamped to their allowed ranges) ──
  const glass = theme.glass;
  const distortion = clamp(glass.distortionStrength, 0, 100);
  const frostBlur = clamp(glass.frostBlur, 0, 30);
  const gray = Math.round(clamp(glass.tintColor, 0, 255));
  const tintOpacity = clamp(glass.tintOpacity, 0, 1);
  const shadowSpread = clamp(glass.shadowSpread, -55, 55);
  const shadowBlur = clamp(glass.shadowBlur, 0, 50);

  // Edge highlight: light edge on dark glass, soft dark edge on light glass.
  const borderColor = isDark
    ? `rgba(255,255,255,${0.08 + (distortion / 100) * 0.3})`
    : `rgba(0,0,0,${0.06 + (distortion / 100) * 0.12})`;

  // Shadow is softer in light mode.
  const shadowColor = isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.18)";

  // Instant highlight: show the tapped tab as active right away,
  // without waiting for the screen switch.
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  useEffect(() => {
    setPendingIndex(null);
  }, [activeIndex]);
  const shownIndex = pendingIndex ?? activeIndex;

  const wrapStyle = useAnimatedStyle(() => {
    const playerProgress = playerExpansionShared.value;

    const playerShift = interpolate(
      playerProgress,
      [0, 0.2],
      [0, navbarHeight + bottomOffset + 8],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ translateY: playerShift }],
    };
  });

  if (hidden) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.barRow,
        wrapStyle,
        {
          // floating bar: lifted above the bottom edge + home indicator
          bottom: bottomOffset,
          // ✅ Distortion Strength: lens edge highlight = border brightness,
          // same on all 4 sides
          borderColor,
          // ✅ Shadow Spread + Shadow Blur (works with a transparent bar,
          // needs React Native 0.76+ / New Architecture)
          boxShadow: [
            {
              offsetX: 0,
              offsetY: -3,
              blurRadius: shadowBlur,
              spreadDistance: shadowSpread,
              color: shadowColor,
            },
          ],
        },
      ]}
    >
      {/* ✅ Glass layer: Frost Blur + Tint Color + Distortion edge */}
      <View pointerEvents="none" style={styles.glassLayer}>
        {frostBlur > 0 && (
          <BlurView
            // Frost Blur 0–30 → expo-blur intensity 0–100
            // (blur is applied on top of the bg colour / content behind it)
            intensity={(frostBlur / 30) * 100}
            tint={glass.blurTint}
            // Android blur (prop names differ between expo-blur versions)
            {...({
              blurMethod: "dimezisBlurView",
              experimentalBlurMethod: "dimezisBlurView",
              blurTarget,
            } as any)}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Tint Color (grayscale 0–255) */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(${gray},${gray},${gray},${tintOpacity})` },
          ]}
        />
      </View>

      {/* ✅ Removed animated opacity wrapper for 0 waiting time */}
      <View style={styles.tabsLayer}>
        {TAB_ITEMS.map((item) => {
          const isActive = item.tabIndex === shownIndex;
          const contentColor = isActive ? theme.primary : theme.textSecondary;

          return (
            <TabButton
              key={item.name}
              item={item}
              entryProgress={navEntryProgress}
              isActive={isActive}
              color={contentColor}
              // Clicking the already-active tab = pink.
              // Switching from another active tab = grey.
              rippleColor={isActive ? NORMAL_RIPPLE_COLOR : FIRST_RIPPLE_COLOR}
              onSelect={() => {
                setPendingIndex(item.tabIndex);
              }}
              onPress={() => onPress(item.name, item.tabIndex)}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

function Tabs() {
  const theme = useTheme();

  const tabNavigationRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // content behind the navbar = what the glass blurs
  const blurTargetRef = useRef<any>(null);
  const TargetView: React.ComponentType<any> = BlurTargetView ?? View;

  const currentRoute = useNavigationState((state) => {
    const route = state.routes[state.index];
    return route?.name;
  });

  const handlePress = (name: NavItemName, tabIndex: number) => {
    const navigation = tabNavigationRef.current;
    if (!navigation) return;

    const initialScreens: Record<string, string> = {
      Home: "HomeMain",
      New: "NewMain",
      Radio: "RadioMain",
      Library: "LibraryMain",
      Search: "SearchMain",
    };

    if (tabIndex === activeIndex) {
      const initial = initialScreens[name];
      if (initial) {
        navigation.navigate(name, { screen: initial });
      }
      return;
    }

    navigation.navigate(name);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <TargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Tab.Navigator
          id="MainTabs"
          tabBar={() => null}
          screenListeners={({ navigation }) => {
            tabNavigationRef.current = navigation;
            return {
              state: (e: any) => {
                const index = e?.data?.state?.index;
                if (typeof index === "number") setActiveIndex(index);
              },
            };
          }}
          screenOptions={{ headerShown: false, animation: "none", lazy: false }}
        >
          <Tab.Screen name="Home" component={HomeStackNavigator} />
          <Tab.Screen name="New" component={NewStackNavigator} />
          <Tab.Screen name="Radio" component={RadioStackNavigator} />
          <Tab.Screen name="Library" component={LibraryStackNavigator} />
          <Tab.Screen name="Search" component={SearchStackNavigator} />
        </Tab.Navigator>
      </TargetView>

      {/* soft fade behind the status bar — content scrolls under it */}
      <TopStatusGlass />

      <MiniPlayer blurTargetRef={blurTargetRef} />
      <VideoPlayerHost />

      <GlassTabBar
        activeIndex={activeIndex}
        hidden={currentRoute === "MusicPlayer"}
        onPress={handlePress}
        blurTarget={blurTargetRef}
      />
    </View>
  );
}

export default function RootNavigator() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {});
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(console.warn);
    }
  }, [ready]);

  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateFavorites = useMediaStore((s) => s.hydrateFavorites);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        await hydrateSettings();
        await hydrateFavorites();
      } catch (error) {
        console.error("[RootNavigator] Initialization failed:", error);
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [hydrateSettings, hydrateFavorites]);

  useEffect(() => {
    const openSharedVideo = (url: string | null) => {
      if (!url) return;

      const match = url.match(/(?:localmedia:\/\/video\/|\/video\/)([^/?#]+)/i);
      if (!match?.[1]) return;

      let videoId = match[1];
      try {
        videoId = decodeURIComponent(videoId);
      } catch {}

      const index = MUSIC_VIDEOS.findIndex((video) => video.id === videoId);
      if (index < 0) return;

      const videoStore = useVideoStore.getState();
      videoStore.playQueue(MUSIC_VIDEOS, index);
      videoStore.setExpanded(true);
    };

    let mounted = true;
    Linking.getInitialURL()
      .then((url) => {
        if (mounted) openSharedVideo(url);
      })
      .catch(() => {});

    const subscription = Linking.addEventListener("url", ({ url }) => {
      openSharedVideo(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const navTheme =
    theme.mode === "dark"
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: theme.background,
            card: theme.surface,
            text: theme.text,
            primary: theme.primary,
            border: theme.border,
            notification: theme.primary,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: theme.background,
            card: theme.surface,
            text: theme.text,
            primary: theme.primary,
            border: theme.border,
            notification: theme.primary,
          },
        };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Queue" component={QueueScreen} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={{ animation: "slide_from_right" }}
          />
        </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
}

// ===========================================================
// ✅ NAVBAR STYLESHEET — all navbar css is written here manually
// ===========================================================
const styles = StyleSheet.create({
  // ── navbar container: height, width (left/right), bg colour, shadow ──
  barRow: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1001,

    // size
    left: 16, // side margin
    right: 16, // side margin
    bottom: 12, // bottom margin (safe-area is added at runtime)
    height: 64, // navbar height
    borderRadius: 50, // 50% of height = full pill

    // border on all sides (colour is set at runtime from the theme)
    borderWidth: 1,
    borderColor: "rgba(234, 226, 226, 0.9)",

    // background colour: transparent (glass layer draws blur + tint)
    backgroundColor: "transparent",

    // shadow comes from boxShadow (spread + blur) set in GlassTabBar
  },

  // blur + tint live here, clipped to the navbar area
  glassLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 31, // barRow radius (32) minus the 1px border
    overflow: "hidden",
  },

  // overflow hidden is here (not on barRow) so the ripple never shows
  // above the nav bar, but the container shadow is not clipped.
  tabsLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 31, // barRow radius (32) minus the 1px border, ripple clipped round
    overflow: "hidden",
  },

  item: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  // full-size centred layer used by both the ripple and the dots
  effectLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  ripple: {
    position: "absolute",
    width: 100, // ripple circle size
    height: 100,
    borderRadius: 50, // half of width/height
    opacity: 0,
  },

  label: {
    fontWeight: "600",
    textAlign: "center",
  },
});