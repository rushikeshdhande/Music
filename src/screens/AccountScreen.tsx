// src/screens/AccountScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { useTheme } from "../hooks/useTheme";
import { useUserStore } from "../store/userStore";
import { showToast } from "../utils/toast";
import { BackArrowIcon } from "../icons/VideoIcons";

const FONT = "sans-serif";

// Legacy storage keys — only used for one-time migration & backup write.
const LEGACY_NAME_KEY = "@account/username";
const LEGACY_NAME_SET_KEY = "@account/name_set";

const ACCOUNT_CHANNEL_ID = "account-updates";

// NOTE: The global Notifications.setNotificationHandler(...) was removed from
// this file. The single handler now lives in
// src/services/notifications/deleteNotificationService.ts (no deprecated
// `shouldShowAlert`, and it keeps delete-progress silent).

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

async function ensureNotificationPermission(): Promise<boolean> {
  try {
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.granted ||
      current.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL ||
      current.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
    if (granted) return true;

    const req = await Notifications.requestPermissionsAsync();
    return (
      req.granted ||
      req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      req.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
    );
  } catch (e) {
    console.warn("[notif] permission error:", e);
    return false;
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

const LIGHT_THEME = {
  mode: "light" as const,
  background: "#edeef0",
  surface: "#ffffff",
  surfaceLight: "#e2e3e5",
  border: "#c8c9cc",
  divider: "#b8b9bc",
  text: "#000000",
  textSecondary: "#3c3c43",
  textMuted: "#8e8e93",
  primary: "#f92c47",
};

const DARK_THEME = {
  mode: "dark" as const,
  background: "#2d2e30",
  surface: "#3a3b3d",
  surfaceLight: "#45464a",
  border: "#525356",
  divider: "#5a5b5e",
  text: "#ffffff",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  primary: "#f92c47",
};

const DISCLAIMER =
  "Your name and photo will be shown to others in playlists or while listing together.";

export default function AccountScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const themeRaw = useTheme() as any;
  const base =
    themeRaw && typeof themeRaw === "object" && themeRaw.background
      ? themeRaw
      : themeRaw?.colors && typeof themeRaw.colors === "object"
        ? themeRaw.colors
        : LIGHT_THEME;

  const COLORS = useMemo(() => {
    const isDark = (base.mode ?? "dark") === "dark";
    const fallback = isDark ? DARK_THEME : LIGHT_THEME;
    return { ...fallback, ...base };
  }, [base]);

  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  // ── Single source of truth: useUserStore persists to @user_profile ──
  const name = useUserStore((s) => s.name);
  const loaded = useUserStore((s) => s.loaded);
  const setName = useUserStore((s) => s.setName);
  const load = useUserStore((s) => s.load);

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

      // Migration: if the store has no name but the legacy key does, promote it.
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

  useEffect(() => {
    ensureNotificationPermission().catch(() => {});
  }, []);

  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  // Derived display values — driven by the store, not local state.
  const trimmedName = name.trim();
  const hasName = trimmedName.length > 0;
  const isReady = loaded;
  const displayName = hasName
    ? trimmedName
    : isReady
      ? "Add your name"
      : "";
  const initial =
    (trimmedName.charAt(0) || "").toUpperCase() || (isReady ? "?" : "·");

  const openEdit = useCallback(() => {
    ensureNotificationPermission().catch(() => {});
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
      // Persist via the store (writes to @user_profile in AsyncStorage).
      await setName(t);

      // Mirror to the legacy key as a recovery backup — harmless on Android.
      await Promise.all([
        AsyncStorage.setItem(LEGACY_NAME_KEY, t).catch(() => {}),
        AsyncStorage.setItem(LEGACY_NAME_SET_KEY, "1").catch(() => {}),
      ]);

      // Close immediately — the store subscription updates the display.
      setEditOpen(false);
      setEditText("");

      // Success notification (best effort).
      const permitted = await ensureNotificationPermission();
      if (permitted) {
        await pushSystemNotification(
          `Welcome, ${t}!`,
          "Your username has been updated successfully.",
        );
      } else {
        showToast("Name saved");
      }
    } catch {
      showToast("Could not save name. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [canContinue, trimmedEdit, setName]);

  const previewInitial = (editText.trim().charAt(0) || "?").toUpperCase();

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          hitSlop={10}
          activeOpacity={0.7}
        >
          <BackArrowIcon size={16} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Account</Text>
      </View>

      {/* Profile card */}
      <View style={styles.cardRow}>
        <View style={[styles.avatarCircle, { borderColor: COLORS.border }]}>
          <Text style={styles.avatarLetter}>{initial}</Text>
        </View>

        <View style={styles.nameBlock}>
          <Text
            numberOfLines={1}
            style={[
              styles.nameText,
              !hasName &&
                isReady && {
                  color: COLORS.textMuted,
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
            <Text style={styles.editName}>{hasName ? "Edit" : "Add"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerWrap}>
        <Text style={[styles.disclaimerText, { color: COLORS.textSecondary }]}>
          {DISCLAIMER}
        </Text>
      </View>

      {/* Divider */}
      <View style={[styles.hairline, { backgroundColor: COLORS.divider }]} />

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
              style={styles.modalCard}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={closeEdit}
                  hitSlop={12}
                  disabled={saving}
                >
                  <Text style={styles.crossIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalRow}>
                <View style={styles.modalAvatarCircle}>
                  <Text style={styles.modalAvatarLetter}>
                    {previewInitial}
                  </Text>
                </View>

                <TextInput
                  value={editText}
                  onChangeText={setEditText}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.modalInput}
                  autoFocus
                  maxLength={40}
                  editable={!saving}
                  selectionColor={COLORS.primary}
                />
              </View>

              <View style={styles.modalFooter}>
                {saving ? (
                  <View style={styles.loadingRowFull}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                    <Text style={styles.loadingText}>Saving changes...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleContinue}
                    disabled={!canContinue}
                    activeOpacity={canContinue ? 0.8 : 1}
                    style={!canContinue && styles.continueBtnDisabled}
                  >
                    <Text
                      style={[
                        styles.continueText,
                        !canContinue && styles.continueTextDisabled,
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

const createStyles = (C: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 24,
    },
    topTitle: {
      color: C.text,
      fontSize: 20,
      fontWeight: "600",
      fontFamily: FONT,
      letterSpacing: -0.3,
    },

    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 20,
      gap: 14,
    },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.surface,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarLetter: {
      color: C.text,
      fontSize: 28,
      fontWeight: "700",
      fontFamily: FONT,
    },
    nameBlock: { flex: 1, minWidth: 0 },
    nameText: {
      color: C.text,
      fontSize: 18,
      fontWeight: "600",
      fontFamily: FONT,
    },
    editName: {
      color: C.primary,
      fontSize: 15,
      fontWeight: "600",
      fontFamily: FONT,
    },
    hairline: { height: StyleSheet.hairlineWidth },

    disclaimerWrap: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    disclaimerText: {
      fontSize: 15,
      lineHeight: 18,
      fontFamily: FONT,
    },

    modalKAV: { flex: 1 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: "#1c1c1e",
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 18,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginBottom: 16,
    },
    crossIcon: {
      color: "#ffffff",
      fontSize: 22,
      fontWeight: "400",
      lineHeight: 24,
    },

    modalRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    modalAvatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    modalAvatarLetter: {
      color: "#ffffff",
      fontSize: 22,
      fontWeight: "700",
      fontFamily: FONT,
    },
    modalInput: {
      flex: 1,
      color: "#ffffff",
      fontSize: 17,
      fontFamily: FONT,
      paddingVertical: 10,
      paddingHorizontal: 0,
      borderWidth: 0,
      borderBottomWidth: 2,
      borderBottomColor: C.primary,
      backgroundColor: "transparent",
    },

    modalFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginTop: 22,
      minHeight: 32,
    },
    continueBtnDisabled: {
      opacity: 0.4,
    },
    continueText: {
      color: C.primary,
      fontSize: 16,
      fontWeight: "700",
      fontFamily: FONT,
      letterSpacing: 0.2,
    },
    continueTextDisabled: {
      color: C.textMuted,
    },
    loadingRowFull: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    loadingText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "500",
      fontFamily: FONT,
    },
  });