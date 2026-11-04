// src/services/notifications/deleteNotificationService.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "song-delete-progress";
const CANCEL_CATEGORY = "song-delete-actions";
const PROGRESS_NOTIF_ID = "song-delete-progress";
const SUCCESS_NOTIF_ID = "song-delete-success";
const FAILED_NOTIF_ID = "song-delete-failed";

// Text bar length: longer = wider bar across the notification
const BAR_LENGTH = 29;

type Phase = "idle" | "progress" | "success" | "failed" | "cancelled";

let cancelHandler: (() => void) | null = null;
let userCancelled = false;
let eventsRegistered = false;
let currentPhase: Phase = "idle";
let lastSong: { songTitle: string; fileSizeMB: number } | null = null;

// Foreground presentation — silent updates for progress, sound for others.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isProgress = notification.request.identifier === PROGRESS_NOTIF_ID;
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !isProgress,
      shouldSetBadge: false,
    };
  },
});

// Thin single-line text bar (low height). 100% => completely full.
// Only the text bar is used (no native progress bar) so height stays normal.
const buildTextBar = (percent: number): string => {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * BAR_LENGTH);
  return "━".repeat(filled) + "─".repeat(Math.max(0, BAR_LENGTH - filled));
};

const clearProgress = async (): Promise<void> => {
  try {
    await Notifications.dismissNotificationAsync(PROGRESS_NOTIF_ID);
  } catch {}
  try {
    await Notifications.cancelScheduledNotificationAsync(PROGRESS_NOTIF_ID);
  } catch {}
  // Some OEMs lag the first dismiss call
  setTimeout(() => {
    Notifications.dismissNotificationAsync(PROGRESS_NOTIF_ID).catch(() => {});
  }, 150);
};

export const setupDeleteNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Song Deletion",
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
    });

    await Notifications.setNotificationCategoryAsync(CANCEL_CATEGORY, [
      {
        identifier: "cancel-delete",
        buttonTitle: "Cancel",
        options: {
          // Don't pull the app to the front just to cancel
          opensAppToForeground: false,
          isDestructive: false,
        },
      },
    ]);

    console.log("[deleteNotif] channel + category ready");
  } catch (e) {
    console.error("[deleteNotif] channel setup failed:", e);
  }
};

export const registerDeleteNotificationEvents = (): void => {
  if (eventsRegistered) return;
  eventsRegistered = true;

  Notifications.addNotificationResponseReceivedListener(async (response) => {
    if (response.actionIdentifier !== "cancel-delete") return;

    const fn = cancelHandler;
    cancelHandler = null;

    // Mark as user-cancelled BEFORE calling the handler so the delete
    // flow can check isDeleteCancelled() and skip error messages.
    userCancelled = true;
    currentPhase = "cancelled";

    if (typeof fn === "function") {
      try {
        fn();
      } catch (e) {
        console.warn("[deleteNotif] cancel handler error:", e);
      }
    }

    // Cancel pressed => just remove the notification. No message shown.
    await clearProgress();
  });
};

// Use this in the delete flow's catch block: if true, the failure was
// caused by the user pressing Cancel, so don't log or show any error.
export const isDeleteCancelled = (): boolean => userCancelled;

export const showDeleteProgress = async (params: {
  songTitle: string;
  fileSizeMB: number;
  progressPercent: number;
  onCancel: () => void;
}): Promise<void> => {
  // Ignore late progress updates after a final state was shown
  if (
    currentPhase === "success" ||
    currentPhase === "failed" ||
    currentPhase === "cancelled"
  )
    return;

  currentPhase = "progress";
  cancelHandler = params.onCancel;
  lastSong = { songTitle: params.songTitle, fileSizeMB: params.fileSizeMB };

  const percent = Math.max(
    0,
    Math.min(100, Math.round(params.progressPercent))
  );
  const sizeStr = `${params.fileSizeMB.toFixed(2)}MB`;

  const content: any = {
    // Header row on Android: [icon] Apple Music • 75% of 7.24MB • Just now
    subtitle: `${percent}% of ${sizeStr}`,
    // Expanded content
    title: params.songTitle,
    body: buildTextBar(percent),
    autoDismiss: false,
    categoryIdentifier: CANCEL_CATEGORY,
    data: { kind: "delete-progress" },
  };

  if (Platform.OS === "android") {
    content.channelId = CHANNEL_ID;
    // Native progress bar intentionally NOT set: it adds extra height.
  }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: PROGRESS_NOTIF_ID,
      content,
      trigger: null,
    });
  } catch (e) {
    console.warn("[deleteNotif] progress failed:", e);
  }
};

export const showDeleteSuccess = async (params: {
  songTitle: string;
  fileSizeMB: number;
}): Promise<void> => {
  currentPhase = "success";
  cancelHandler = null;

  await clearProgress();

  const sizeStr = `${params.fileSizeMB.toFixed(2)}MB`;

  const content: any = {
    subtitle: `100% of ${sizeStr}`,
    title: params.songTitle,
    body: "Delete successfully",
    autoDismiss: true,
    data: { kind: "delete-success" },
  };

  if (Platform.OS === "android") content.channelId = CHANNEL_ID;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: SUCCESS_NOTIF_ID,
      content,
      trigger: null,
    });
  } catch (e) {
    console.warn("[deleteNotif] success failed:", e);
  }
};

// Shown when delete is cancelled or throws (e.g. no write permission).
// Bar is shown completely full on a single compact line.
export const showDeleteFailed = async (params: {
  songTitle: string;
  fileSizeMB: number;
  reason?: string;
}): Promise<void> => {
  // User pressed Cancel => never show a failed message
  if (userCancelled || currentPhase === "cancelled") {
    await clearProgress();
    return;
  }

  currentPhase = "failed";
  cancelHandler = null;

  await clearProgress();

  const sizeStr = `${params.fileSizeMB.toFixed(2)}MB`;

  const content: any = {
    subtitle: `Delete failed • ${sizeStr}`,
    title: params.songTitle,
    body: buildTextBar(100),
    autoDismiss: true,
    data: { kind: "delete-failed", reason: params.reason ?? "" },
  };

  if (Platform.OS === "android") content.channelId = CHANNEL_ID;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: FAILED_NOTIF_ID,
      content,
      trigger: null,
    });
    console.log("[deleteNotif] failed shown");
  } catch (e) {
    console.warn("[deleteNotif] failed-notification error:", e);
  }
};

// Call this at the START of every new deletion to reset state.
export const dismissDeleteNotification = async (): Promise<void> => {
  currentPhase = "idle";
  cancelHandler = null;
  userCancelled = false;
  lastSong = null;
  try {
    await Notifications.dismissNotificationAsync(PROGRESS_NOTIF_ID);
  } catch {}
  try {
    await Notifications.cancelScheduledNotificationAsync(PROGRESS_NOTIF_ID);
  } catch {}
  try {
    await Notifications.dismissNotificationAsync(FAILED_NOTIF_ID);
  } catch {}
};