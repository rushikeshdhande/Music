// src/screens/SettingsScreen.tsx
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import * as Application from "expo-application";
import Constants from "expo-constants";

import { useTheme } from "../hooks/useTheme";
import { useSettingsStore } from "../store/settingsStore";
import { useExtraSettings } from "../store/extraSettingsStore";
import { useMediaScanner } from "../hooks/useMediaScanner";
import { safeGoBack } from "../utils/navigation";
import { showToast } from "../utils/toast";
import type { ThemeMode } from "../types";
import TopStatusGlass from "../components/TopStatusGlass";
import { getOtaInfo, checkForUpdatesManually } from "../components/OtaUpdater";

const SYSTEM_FONT = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "sans-serif",
});
const ACCENT = "#f92c47";
const DANGER = "#ff3b30";
const SWITCH_COLOR = "#007AFF";

const PORTFOLIO_FALLBACK = "https://rushicdhande.vercel.app/";
const CONTACT_EMAIL = "rushicdhande@gmail.com";

const THEME_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System Default" },
];

// ✅ NEW: Widget style options
type WidgetStyle = "light" | "dark" | "system";
type WidgetSize = "small" | "medium" | "large";

const WIDGET_STYLE_OPTIONS: { key: WidgetStyle; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System Default" },
];

const WIDGET_SIZE_OPTIONS: { key: WidgetSize; label: string }[] = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
];

function getPortfolioUrl(): string {
  const fromConfig =
    (Constants.expoConfig?.extra as any)?.portfolioUrl ??
    (Constants as any).manifest?.extra?.portfolioUrl ??
    (Constants as any).manifest2?.extra?.expoClient?.extra?.portfolioUrl;

  return typeof fromConfig === "string" && fromConfig.length > 0
    ? fromConfig
    : PORTFOLIO_FALLBACK;
}

const BackArrowIcon = ({
  size = 22,
  color = "#000",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fill={color}
      d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z"
    />
  </Svg>
);

const ChevronIcon = ({ size = 14, color = "#c4c4c6" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 6l6 6-6 6"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

function SettingsSection({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: any;
}) {
  const isDark = theme.mode === "dark";
  return (
    <View style={styles.section}>
      <Text
        style={[styles.sectionTitle, { color: isDark ? "#8e8e93" : "#6e6e73" }]}
      >
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: isDark ? "#1c1c1e" : "#ffffff" },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  accessory?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  destructive?: boolean;
  theme: any;
};

function SettingsRow({
  title,
  subtitle,
  value,
  accessory,
  onPress,
  isLast,
  destructive,
  theme,
}: RowProps) {
  const isDark = theme.mode === "dark";
  const textColor = destructive ? DANGER : theme.text;

  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.6}
        style={styles.row}
      >
        <View style={styles.rowLeft}>
          <Text style={[styles.rowTitle, { color: textColor }]}>{title}</Text>
          {subtitle ? (
            <Text
              style={[
                styles.rowSubtitle,
                { color: isDark ? "#8e8e93" : "#6e6e73" },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {value ? (
          <Text
            style={[styles.rowValue, { color: isDark ? "#8e8e93" : "#6e6e73" }]}
          >
            {value}
          </Text>
        ) : null}

        {accessory ? (
          <View style={styles.rowAccessory}>{accessory}</View>
        ) : onPress ? (
          <View style={styles.rowAccessory}>
            <ChevronIcon color={isDark ? "#8e8e93" : "#c4c4c6"} />
          </View>
        ) : null}
      </TouchableOpacity>

      {!isLast && (
        <View
          style={[
            styles.divider,
            { backgroundColor: isDark ? "#38383a" : "#e5e5ea" },
          ]}
        />
      )}
    </>
  );
}

function Toggle({
  value,
  onChange,
  color = SWITCH_COLOR,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: color, false: "#e5e5ea" }}
      thumbColor={"#ffffff"}
      ios_backgroundColor="#e5e5ea"
    />
  );
}

type ModalOption = {
  text: string;
  onPress?: () => void;
  destructive?: boolean;
};

type ModalState = {
  title: string;
  message?: string;
  options: ModalOption[];
} | null;

function SettingsModal({
  state,
  onClose,
  theme,
}: {
  state: ModalState;
  onClose: () => void;
  theme: any;
}) {
  const lastRef = useRef<ModalState>(null);
  if (state) lastRef.current = state;
  const view = state ?? lastRef.current;
  const isDark = theme.mode === "dark";

  return (
    <Modal
      visible={!!state}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
              borderColor: isDark ? "#38383a" : "#e5e5ea",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {view?.title ? (
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {view.title}
            </Text>
          ) : null}

          {view?.message ? (
            <Text
              style={[
                styles.modalMessage,
                { color: isDark ? "#8e8e93" : "#6e6e73" },
              ]}
            >
              {view.message}
            </Text>
          ) : null}

          <View
            style={[
              styles.modalDivider,
              { backgroundColor: isDark ? "#38383a" : "#e5e5ea" },
            ]}
          />

          {(view?.options ?? []).map((opt, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const color = opt.destructive ? DANGER : theme.iconsColour;

            return (
              <TouchableOpacity
                key={`${opt.text}-${idx}`}
                activeOpacity={0.6}
                style={[
                  styles.modalOption,
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: isDark ? "#38383a" : "#e5e5ea",
                  },
                ]}
                onPress={() => {
                  onClose();
                  if (opt.onPress) setTimeout(() => opt.onPress?.(), 150);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color, fontWeight: opt.destructive ? "600" : "400" },
                  ]}
                >
                  {opt.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ThemePopup({
  visible,
  onClose,
  current,
  onSelect,
  accent,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  current: ThemeMode;
  onSelect: (key: ThemeMode, label: string) => void;
  accent: string;
  isDark: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
              borderColor: isDark ? "#38383a" : "#e5e5ea",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={[styles.modalTitle, { color: isDark ? "#fff" : "#000" }]}
          >
            Theme
          </Text>

          {THEME_OPTIONS.map((opt) => {
            const selected = current === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.6}
                style={styles.themeRow}
                onPress={() => onSelect(opt.key, opt.label)}
              >
                <View style={styles.themeRowLeft}>
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: isDark ? "#fff" : "#000" },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </View>
                {selected && (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M20 6L9 17l-5-5"
                      stroke={accent}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </TouchableOpacity>
            );
          })}

          <View
            style={[
              styles.modalDivider,
              { backgroundColor: isDark ? "#38383a" : "#e5e5ea" },
            ]}
          />

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.6}
            style={styles.modalOption}
          >
            <Text
              style={[
                styles.modalOptionText,
                { color: accent, fontWeight: "600" },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ✅ NEW: Generic option picker popup (reused for widget style & size)
function OptionPickerPopup<T extends string>({
  visible,
  onClose,
  title,
  options,
  current,
  onSelect,
  accent,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { key: T; label: string }[];
  current: T;
  onSelect: (key: T, label: string) => void;
  accent: string;
  isDark: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: isDark ? "#1c1c1e" : "#ffffff",
              borderColor: isDark ? "#38383a" : "#e5e5ea",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={[styles.modalTitle, { color: isDark ? "#fff" : "#000" }]}
          >
            {title}
          </Text>

          {options.map((opt) => {
            const selected = current === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.6}
                style={styles.themeRow}
                onPress={() => onSelect(opt.key, opt.label)}
              >
                <View style={styles.themeRowLeft}>
                  <Text
                    style={[
                      styles.themeLabel,
                      { color: isDark ? "#fff" : "#000" },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </View>
                {selected && (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M20 6L9 17l-5-5"
                      stroke={accent}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </TouchableOpacity>
            );
          })}

          <View
            style={[
              styles.modalDivider,
              { backgroundColor: isDark ? "#38383a" : "#e5e5ea" },
            ]}
          />

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.6}
            style={styles.modalOption}
          >
            <Text
              style={[
                styles.modalOptionText,
                { color: accent, fontWeight: "600" },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const theme = useTheme() as any;
  const nav = useNavigation<any>();
  const s = useSettingsStore();
  const x = useExtraSettings();
  const { scanEverything } = useMediaScanner();

  const insets = useSafeAreaInsets();

  const isDark = theme.mode === "dark";
  const accent = theme.iconsColour ?? ACCENT;

  const glassBg = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const glassBorder = isDark
    ? "rgba(255, 255, 255, 0.25)"
    : "rgba(0, 0, 0, 0.15)";

  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = useCallback(() => setModal(null), []);

  const [themeOpen, setThemeOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  // ✅ NEW: Widget popups
  const [widgetStyleOpen, setWidgetStyleOpen] = useState(false);
  const [widgetSizeOpen, setWidgetSizeOpen] = useState(false);

  const appVersion =
    Constants.expoConfig?.version ??
    Application.nativeApplicationVersion ??
    "1.0.0";
  const otaInfo = getOtaInfo();

  const otaBundleStatus = otaInfo.updateId
    ? "OTA Update Active"
    : "Embedded APK Bundle";
  const portfolioUrl = getPortfolioUrl();

  const currentThemeLabel =
    s.theme === "light"
      ? "Light"
      : s.theme === "system"
        ? "System Default"
        : "Dark";

  // ✅ NEW: Widget values with safe fallbacks
  const widgetEnabled = !!x.widgetsEnabled;
  const widgetStyle: WidgetStyle = (x.widgetStyle as WidgetStyle) ?? "system";
  const widgetSize: WidgetSize = (x.widgetSize as WidgetSize) ?? "medium";
  const widgetShowNowPlaying = !!x.widgetShowNowPlaying;

  const currentWidgetStyleLabel =
    WIDGET_STYLE_OPTIONS.find((o) => o.key === widgetStyle)?.label ??
    "System Default";
  const currentWidgetSizeLabel =
    WIDGET_SIZE_OPTIONS.find((o) => o.key === widgetSize)?.label ?? "Medium";

  const openPortfolio = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(portfolioUrl);
      if (!supported) return showToast("Cannot open link");
      await Linking.openURL(portfolioUrl);
    } catch (error) {
      showToast("Cannot open link");
    }
  }, [portfolioUrl]);

  const openEmail = useCallback(async () => {
    try {
      const url = `mailto:${CONTACT_EMAIL}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) return showToast("Cannot open email app");
      await Linking.openURL(url);
    } catch (error) {
      showToast("Cannot open email app");
    }
  }, []);

  const onRescan = useCallback(async () => {
    if (scanning) return;
    try {
      setScanning(true);
      showToast("Scanning media...");
      await scanEverything();
      showToast("Rescan complete");
    } catch (error) {
      showToast("Rescan failed");
    } finally {
      setScanning(false);
    }
  }, [scanEverything, scanning]);

  const handleSelectTheme = useCallback(
    (key: ThemeMode, label: string) => {
      s.setTheme(key);
      setThemeOpen(false);
      showToast(`Theme: ${label}`);
    },
    [s],
  );

  // ✅ NEW: Widget handlers
  const handleSelectWidgetStyle = useCallback(
    (key: WidgetStyle, label: string) => {
      x.setWidgetStyle(key);
      setWidgetStyleOpen(false);
      showToast(`Widget style: ${label}`);
    },
    [x],
  );

  const handleSelectWidgetSize = useCallback(
    (key: WidgetSize, label: string) => {
      x.setWidgetSize(key);
      setWidgetSizeOpen(false);
      showToast(`Widget size: ${label}`);
    },
    [x],
  );

  const openResetModal = useCallback(() => {
    setModal({
      title: "Reset All Settings",
      message:
        "This will restore every option to its default value. Your media and favourites will not be affected.",
      options: [
        {
          text: "Reset Everything",
          destructive: true,
          onPress: () => {
            try {
              s.setTheme("system");
              s.setDynamicBg(true);
              s.setAutoRescan(true);
              s.setNotifications(true);
              s.setDefaultSpeed(1);
              s.setShuffle(false);
              s.setRepeat("off");
              s.setContinuePlayback(true);
              s.setKeepAwake(false);
              x.reset();
              showToast("Settings reset");
            } catch {
              showToast("Reset failed");
            }
          },
        },
        { text: "Cancel" },
      ],
    });
  }, [s, x]);

  return (
    <View
      style={[styles.root, { backgroundColor: isDark ? "#000000" : "#f2f2f7" }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scrollingHeader}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Settings
          </Text>
        </View>

        <SettingsSection title="Media" theme={theme}>
          <SettingsRow
            theme={theme}
            title="Rescan Now"
            subtitle={scanning ? "Scanning..." : "Refresh audio library"}
            onPress={onRescan}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Appearance" theme={theme}>
          <SettingsRow
            theme={theme}
            title="Theme"
            value={currentThemeLabel}
            onPress={() => setThemeOpen(true)}
          />
          <SettingsRow
            theme={theme}
            title="Dynamic Artwork Background"
            subtitle="Colour the player from the artwork"
            accessory={
              <Toggle
                value={!!s.dynamicBg}
                onChange={(v) => {
                  s.setDynamicBg(v);
                  showToast(v ? "Dynamic BG ON" : "Dynamic BG OFF");
                }}
              />
            }
            isLast
          />
        </SettingsSection>

        <SettingsSection title="About" theme={theme}>
          <SettingsRow theme={theme} title="Version" value={appVersion} />
          <SettingsRow
            theme={theme}
            title="Portfolio"
            subtitle="Open in browser"
            onPress={openPortfolio}
          />
          <SettingsRow
            theme={theme}
            title="Reset All Settings"
            destructive
            onPress={openResetModal}
            isLast
          />
        </SettingsSection>

        {/* ✅ NEW: Home Screen Widgets section */}
        <SettingsSection title="Home Screen Widgets" theme={theme}>
          <SettingsRow
            theme={theme}
            title="Enable Widgets"
            subtitle="Show music controls on your home screen"
            accessory={
              <Toggle
                value={widgetEnabled}
                onChange={(v) => {
                  x.setWidgetsEnabled(v);
                  showToast(v ? "Widgets enabled" : "Widgets disabled");
                }}
              />
            }
          />
          <SettingsRow
            theme={theme}
            title="Widget Style"
            subtitle="Light, dark, or match system"
            value={currentWidgetStyleLabel}
            onPress={() => setWidgetStyleOpen(true)}
          />
          <SettingsRow
            theme={theme}
            title="Widget Size"
            subtitle="Small, medium, or large layout"
            value={currentWidgetSizeLabel}
            onPress={() => setWidgetSizeOpen(true)}
          />
          <SettingsRow
            theme={theme}
            title="Show Now Playing"
            subtitle="Display the current track in the widget"
            accessory={
              <Toggle
                value={widgetShowNowPlaying}
                onChange={(v) => {
                  x.setWidgetShowNowPlaying(v);
                  showToast(v ? "Now Playing ON" : "Now Playing OFF");
                }}
              />
            }
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Software Update" theme={theme}>
          <SettingsRow
            theme={theme}
            title="Check for Updates"
            subtitle="Check and download latest updates"
            onPress={() => {
              void checkForUpdatesManually();
            }}
          />

          <SettingsRow
            theme={theme}
            title="Update Channel"
            value={otaInfo.channel ?? "Unknown"}
          />

          <SettingsRow
            theme={theme}
            title="Runtime Version"
            value={otaInfo.runtimeVersion ?? "Unknown"}
          />

          <SettingsRow
            theme={theme}
            title="Update Status"
            value={!otaInfo.enabled ? "Disabled" : otaBundleStatus}
          />

          <SettingsRow
            theme={theme}
            title="Update ID"
            value={
              otaInfo.updateId
                ? `${otaInfo.updateId.slice(0, 8)}...`
                : "Embedded"
            }
            isLast
          />
        </SettingsSection>
      </ScrollView>

      {/* Sticky Back Button */}
      <TouchableOpacity
        onPress={() => safeGoBack(nav)}
        style={[
          styles.stickyBackBtn,
          {
            top: insets.top + 28,
            backgroundColor: glassBg,
            borderColor: glassBorder,
          },
        ]}
        hitSlop={10}
        activeOpacity={0.7}
      >
        <BackArrowIcon size={22} color={theme.text} />
      </TouchableOpacity>

      <TopStatusGlass />

      <ThemePopup
        visible={themeOpen}
        onClose={() => setThemeOpen(false)}
        current={s.theme}
        onSelect={handleSelectTheme}
        accent={accent}
        isDark={isDark}
      />

      {/* ✅ NEW: Widget style picker */}
      <OptionPickerPopup<WidgetStyle>
        visible={widgetStyleOpen}
        onClose={() => setWidgetStyleOpen(false)}
        title="Widget Style"
        options={WIDGET_STYLE_OPTIONS}
        current={widgetStyle}
        onSelect={handleSelectWidgetStyle}
        accent={accent}
        isDark={isDark}
      />

      {/* ✅ NEW: Widget size picker */}
      <OptionPickerPopup<WidgetSize>
        visible={widgetSizeOpen}
        onClose={() => setWidgetSizeOpen(false)}
        title="Widget Size"
        options={WIDGET_SIZE_OPTIONS}
        current={widgetSize}
        onSelect={handleSelectWidgetSize}
        accent={accent}
        isDark={isDark}
      />

      <SettingsModal state={modal} onClose={closeModal} theme={theme} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  scrollingHeader: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    textAlign: "center",
  },

  stickyBackBtn: {
    position: "absolute",
    left: 16,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
  },

  section: { marginTop: 24 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: SYSTEM_FONT,
    fontWeight: "400",
    marginBottom: 8,
    marginLeft: 16,
    textTransform: "uppercase",
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  rowLeft: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 13,
    fontFamily: SYSTEM_FONT,
    fontWeight: "400",
    marginTop: 4,
    lineHeight: 18,
  },
  rowValue: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
    fontWeight: "400",
    marginLeft: 12,
  },
  rowAccessory: { marginLeft: 12 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },

  footerSection: {
    marginTop: 40,
    marginBottom: 24,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  footerQuote: {
    fontSize: 15,
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  footerQuoteAccent: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  footerDivider: {
    width: 48,
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
    opacity: 0.7,
  },
  footerGreeting: {
    fontSize: 14,
    fontFamily: SYSTEM_FONT,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  footerContact: {
    fontSize: 12.5,
    fontFamily: SYSTEM_FONT,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 18,
    opacity: 0.85,
  },
  footerEmail: {
    fontFamily: SYSTEM_FONT,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  modalMessage: {
    fontSize: 13,
    fontFamily: SYSTEM_FONT,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalDivider: { height: StyleSheet.hairlineWidth },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    alignItems: "center",
  },
  modalOptionText: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
  },

  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  themeRowLeft: { flex: 1 },
  themeLabel: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
  },
});
