// src/screens/AccountScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Linking,
  AppState,
  BackHandler,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../hooks/useTheme";
import { useUserStore } from "../store/userStore";
import { showToast } from "../utils/toast";
import { safeGoBack } from "../utils/navigation";
import TopStatusGlass from "../components/TopStatusGlass";

const SYSTEM_FONT = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "sans-serif",
});

const ACCENT = "#f92c47";
const DANGER = "#ff3b30";

// Legacy storage keys — only used for one-time migration & backup write.
const LEGACY_NAME_KEY = "@account/username";
const LEGACY_NAME_SET_KEY = "@account/name_set";

// Notification preferences
const NEW_MUSIC_NOTIF_KEY = "@account/new_music_notif";
const DELETE_NOTIF_KEY = "@song/delete_notif";
const PROFILE_NOTIF_KEY = "@account/profile_change_notif"; // <-- ADD THIS
const ACCOUNT_CHANNEL_ID = "account-updates";

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ACCOUNT_CHANNEL_ID, {
      name: "Account updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f92c47",
    });
  } catch (e) {
    console.warn("[notif] channel setup failed:", e);
  }
}

async function pushSystemNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        ...(Platform.OS === "android" ? { channelId: ACCOUNT_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("[notif] failed to schedule:", e);
  }
}

const DISCLAIMER =
  "Your name and photo will be shown to others in playlists or while listing together.";

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

const ExternalLinkIcon = ({ size = 20, color = "#007AFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 19H5V5H12V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V12H19V19ZM14 3V5H17.59L7.76 14.83L9.17 16.24L19 6.41V10H21V3H14Z"
      fill={color}
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

export default function AccountScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const theme = useTheme() as any;

  const isDark = theme.mode === "dark";
  const accent = theme.iconsColour ?? ACCENT;

  // ✅ Solid glass colors for the back button without shadows
  const glassBg = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const glassBorder = isDark
    ? "rgba(255, 255, 255, 0.25)"
    : "rgba(0, 0, 0, 0.15)";

  // ── Single source of truth: useUserStore persists to @user_profile ──
  const name = useUserStore((s) => s.name);
  const loaded = useUserStore((s) => s.loaded);
  const setName = useUserStore((s) => s.setName);
  const load = useUserStore((s) => s.load);

  // Navigation state for "Manage Notifications" page
  const [showNotificationsPage, setShowNotificationsPage] = useState(false);

  // Permission & Toggles
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [newMusicEnabled, setNewMusicEnabled] = useState(true);
  const [deleteEnabled, setDeleteEnabled] = useState(true);
  const [profileNotifEnabled, setProfileNotifEnabled] = useState(true);
  // ── Load notification settings & permission ──
  const checkPermission = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotifGranted(status === "granted");
    } catch {
      setNotifGranted(false);
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [newMusicVal, deleteVal, profileVal] = await Promise.all([
          AsyncStorage.getItem(NEW_MUSIC_NOTIF_KEY),
          AsyncStorage.getItem(DELETE_NOTIF_KEY),
          AsyncStorage.getItem(PROFILE_NOTIF_KEY), // <-- ADD THIS
        ]);
        if (newMusicVal !== null) setNewMusicEnabled(newMusicVal === "true");
        if (deleteVal !== null) setDeleteEnabled(deleteVal === "true");
        if (profileVal !== null) setProfileNotifEnabled(profileVal === "true"); // <-- ADD THIS
      } catch (e) {
        console.warn("Failed to load notif settings", e);
      }
    };

    loadSettings();
    checkPermission();

    // Re-check permission when user returns from device settings
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkPermission();
    });

    return () => sub.remove();
  }, [checkPermission]);

  const toggleNewMusic = async (val: boolean) => {
    setNewMusicEnabled(val);
    await AsyncStorage.setItem(NEW_MUSIC_NOTIF_KEY, String(val));
    showToast(val ? "New Music alerts ON" : "New Music alerts OFF");
  };

  const toggleDelete = async (val: boolean) => {
    setDeleteEnabled(val);
    await AsyncStorage.setItem(DELETE_NOTIF_KEY, String(val));
    showToast(val ? "Delete alerts ON" : "Delete alerts OFF");
  };
  const toggleProfileNotif = async (val: boolean) => {
    setProfileNotifEnabled(val);
    await AsyncStorage.setItem(PROFILE_NOTIF_KEY, String(val));
    showToast(val ? "Profile change alerts ON" : "Profile change alerts OFF");
  };
  const openSystemSettings = () => {
    Linking.openSettings().catch(() => showToast("Could not open settings"));
  };

  // ── One-time load + legacy migration ──
  useEffect(() => {
    if (loaded) return;

    let alive = true;
    (async () => {
      try {
        await load();
      } catch (e) {
        console.warn("[account] load failed:", e);
      }

      if (!alive) return;

      try {
        const storeNow = (useUserStore.getState().name ?? "").trim();
        if (!storeNow) {
          const legacy = (await AsyncStorage.getItem(LEGACY_NAME_KEY)) ?? "";
          const trimmed = legacy.trim();
          if (trimmed) {
            await setName(trimmed);
          }
        }
      } catch (e) {
        console.warn("[account] migration failed:", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loaded, load, setName]);

  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const hasName = trimmedName.length > 0;
  const isReady = loaded;
  const displayName = hasName ? trimmedName : isReady ? "Add your name" : "";
  const initial =
    (trimmedName.charAt(0) || "").toUpperCase() || (isReady ? "?" : "·");

  const openEdit = useCallback(() => {
    setEditText(trimmedName);
    setEditOpen(true);
  }, [trimmedName]);

  const closeEdit = useCallback(() => {
    if (saving) return;
    setEditOpen(false);
  }, [saving]);

  const trimmedEdit = editText.trim();
  const canContinue =
    !saving && trimmedEdit.length > 0 && trimmedEdit !== trimmedName;

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;
    const t = trimmedEdit;
    setSaving(true);
    try {
      await setName(t);

      setEditOpen(false);
      setEditText("");

      if (notifGranted && profileNotifEnabled) {
        await pushSystemNotification(
          `Welcome, ${t}!`,
          "Your username has been updated successfully.",
        );
      } else {
        showToast("Name saved");
      }
    } catch (error) {
      console.error("[account] username save failed:", error);
      showToast("Could not save name. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [canContinue, trimmedEdit, setName, notifGranted, profileNotifEnabled]); // <-- ADD profileNotifEnabled HERE

  const previewInitial = (editText.trim().charAt(0) || "?").toUpperCase();
  // Handle Android hardware back button for the Notifications page
  useEffect(() => {
    if (!showNotificationsPage) return;

    const onBackPress = () => {
      setShowNotificationsPage(false);
      return true; // Prevent default navigation (which would go to Home)
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => subscription.remove();
  }, [showNotificationsPage]);
  // ── Render Notifications Page ──
  if (showNotificationsPage) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: isDark ? "#000000" : "#f2f2f7" },
        ]}
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
              Notifications
            </Text>
          </View>

          <SettingsSection title="" theme={theme}>
            {notifGranted === false ? (
              <TouchableOpacity
                onPress={openSystemSettings}
                activeOpacity={0.6}
                style={styles.row}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>
                    Allow Notifications
                  </Text>
                </View>
                <View style={styles.rowAccessory}>
                  <ExternalLinkIcon size={20} color="#007AFF" />
                </View>
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>
                      New Music
                    </Text>
                    <Text
                      style={[
                        styles.rowSubtitle,
                        { color: isDark ? "#8e8e93" : "#6e6e73" },
                      ]}
                    >
                      Artists you like release new music and videos.
                    </Text>
                  </View>
                  <View style={styles.rowAccessory}>
                    <Switch
                      value={newMusicEnabled}
                      onValueChange={toggleNewMusic}
                      trackColor={{ true: "#007AFF", false: "#e5e5ea" }}
                    />
                  </View>
                </View>

                <View
                  style={[
                    styles.divider,
                    { backgroundColor: isDark ? "#38383a" : "#e5e5ea" },
                  ]}
                />

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>
                      Delete Song
                    </Text>
                    <Text
                      style={[
                        styles.rowSubtitle,
                        { color: isDark ? "#8e8e93" : "#6e6e73" },
                      ]}
                    >
                      Show notifications when deleting songs from your device.
                    </Text>
                  </View>
                  <View style={styles.rowAccessory}>
                    <Switch
                      value={deleteEnabled}
                      onValueChange={toggleDelete}
                      trackColor={{ true: "#007AFF", false: "#e5e5ea" }}
                    />
                  </View>
                </View>

                <View
                  style={[
                    styles.divider,
                    { backgroundColor: isDark ? "#38383a" : "#e5e5ea" },
                  ]}
                />

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>
                      Profile Updates
                    </Text>
                    <Text
                      style={[
                        styles.rowSubtitle,
                        { color: isDark ? "#8e8e93" : "#6e6e73" },
                      ]}
                    >
                      Show notifications when your profile name is changed.
                    </Text>
                  </View>
                  <View style={styles.rowAccessory}>
                    <Switch
                      value={profileNotifEnabled}
                      onValueChange={toggleProfileNotif}
                      trackColor={{ true: "#007AFF", false: "#e5e5ea" }}
                    />
                  </View>
                </View>
              </>
            )}
          </SettingsSection>

          <Text
            style={[
              styles.footerNote,
              { color: isDark ? "#8e8e93" : "#6e6e73" },
            ]}
          >
            {notifGranted === false
              ? "To get your updates, allow notifications on this device."
              : "Manage your notification preferences here."}
          </Text>
        </ScrollView>

        <TouchableOpacity
          onPress={() => setShowNotificationsPage(false)}
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
      </View>
    );
  }

  // ── Render Main Account Page ──
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
            Account
          </Text>
        </View>

        <SettingsSection title="Profile" theme={theme}>
          <View style={styles.profileRow}>
            <View
              style={[
                styles.avatarCircle,
                {
                  borderColor: "transparent",
                  backgroundColor: isDark ? "#3a3b3d" : "#e5e5ea",
                },
              ]}
            >
              <Text style={[styles.avatarLetter, { color: theme.text }]}>
                {initial}
              </Text>
            </View>

            <View style={styles.nameBlock}>
              <Text
                numberOfLines={1}
                style={[
                  styles.nameText,
                  { color: theme.text },
                  !hasName &&
                    isReady && {
                      color: isDark ? "#8e8e93" : "#6e6e73",
                      fontStyle: "italic",
                    },
                ]}
              >
                {displayName}
              </Text>
            </View>

            {isReady && (
              <TouchableOpacity
                onPress={openEdit}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.editName, { color: "#007AFF" }]}>
                  {hasName ? "Edit" : "Add"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </SettingsSection>

        {/* <SettingsSection title="" theme={theme}>
          <SettingsRow
            theme={theme}
            title="Setup Profile"
            subtitle={DISCLAIMER}
            isLast
          />
        </SettingsSection> */}

        {/* <SettingsSection title="Subscription" theme={theme}>
          <SettingsRow
            theme={theme}
            title="Upgrade to Family"
            isLast={false}
          />
          <SettingsRow
            theme={theme}
            title="Manage Subscription"
            isLast={false}
          />
          <SettingsRow
            theme={theme}
            title="Country/Region"
            isLast={false}
          />
          <SettingsRow
            theme={theme}
            title="Redeem Code"
            isLast
          />
        </SettingsSection> */}

        <SettingsSection title="Notifications" theme={theme}>
          <SettingsRow
            theme={theme}
            title="Manage Notifications"
            onPress={() => setShowNotificationsPage(true)}
            isLast
          />
        </SettingsSection>
      </ScrollView>

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

      {/* Edit-name modal */}
      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={styles.modalKAV}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeEdit}>
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
              {/* Top Header Row with X and Title */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={closeEdit}
                  disabled={saving}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalHeaderBtn, { color: theme.text }]}>
                    ✕
                  </Text>
                </TouchableOpacity>

                {/* Empty View to balance the layout so the title stays centered */}
                <View style={{ width: 20 }} />
              </View>

              {/* Input Row */}
              <View style={styles.modalRow}>
                <View
                  style={[
                    styles.modalAvatarCircle,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.18)"
                        : "rgba(0,0,0,0.12)",
                    },
                  ]}
                >
                  <Text
                    style={[styles.modalAvatarLetter, { color: theme.text }]}
                  >
                    {previewInitial}
                  </Text>
                </View>

                <TextInput
                  value={editText}
                  onChangeText={setEditText}
                  placeholder="Your name"
                  placeholderTextColor={
                    isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"
                  }
                  style={[
                    styles.modalInput,
                    {
                      color: theme.text,
                      borderBottomColor: accent,
                    },
                  ]}
                  autoFocus
                  maxLength={40}
                  editable={!saving}
                  selectionColor={accent}
                />
              </View>

              {/* Bottom Right Save Button */}
              <View style={styles.modalFooter}>
                {saving ? (
                  <ActivityIndicator color={accent} size="small" />
                ) : (
                  <TouchableOpacity
                    onPress={handleContinue}
                    disabled={!canContinue}
                    activeOpacity={canContinue ? 0.7 : 1}
                    style={[
                      styles.modalSaveBtn,
                      !canContinue && { opacity: 0.4 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalSaveBtnText,
                        {
                          // Change this to whatever color you want
                          color: canContinue
                            ? accent
                            : isDark
                              ? "#c8c3c3"
                              : "#999999",
                        },
                      ]}
                    >
                      Continue
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 9,
    minHeight: 40,
  },
  avatarCircle: {
    width: 45,
    height: 45,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: SYSTEM_FONT,
  },
  nameBlock: { flex: 1, minWidth: 0 },
  nameText: {
    fontSize: 17,
    fontWeight: "400",
    fontFamily: SYSTEM_FONT,
    letterSpacing: -0.2,
  },
  editName: {
    fontSize: 17,
    fontWeight: "400",
    fontFamily: SYSTEM_FONT,
  },

  disclaimerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: SYSTEM_FONT,
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: SYSTEM_FONT,
    paddingHorizontal: 20,
    marginTop: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 65,
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

  modalKAV: { flex: 1 },
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
    paddingBottom: 20,
    minHeight: 180,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 10,
  },
  modalAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  modalAvatarLetter: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: SYSTEM_FONT,
  },
  modalInput: {
    flex: 1,
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 0,
    borderBottomWidth: 0.4,
    backgroundColor: "transparent",
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
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end", // Pushes items to the right
    paddingHorizontal: 20,
    marginTop: 10,
    minHeight: 30,
  },
  modalSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    fontSize: 16,
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
  },
  // ADD THESE NEW HEADER STYLES:
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
    fontWeight: "600",
    textAlign: "center",
  },
  modalHeaderBtn: {
    fontSize: 17,
    fontFamily: SYSTEM_FONT,
  },

  loadingRowFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: SYSTEM_FONT,
  },
});
