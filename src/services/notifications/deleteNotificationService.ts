// src/services/notifications/deleteNotificationService.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device"; // ✅ डिव्हाइसचे नाव मिळवण्यासाठी इम्पोर्ट केले
import { Platform } from "react-native";

const CHANNEL_ID = "song-delete-progress-v2";
const CANCEL_CATEGORY = "song-delete-actions";
const WAITING_NOTIF_ID = "song-delete-waiting";
const PROGRESS_NOTIF_ID = "song-delete-progress";

const SUCCESS_PREFIX = "song-delete-success-";
const FAILED_PREFIX = "song-delete-failed-";

const BAR_LENGTH = 29;

const MIN_PROGRESS_INTERVAL_MS = 200;
const MIN_PROGRESS_VISIBLE_MS = 100;
const FILL_STEP_PERCENT = 10;
const FILL_STEP_MIN_MS = 150;
const FILL_STEP_MAX_MS = 300;
const COMPLETE_HOLD_MS = 200;

type Phase = "idle" | "progress" | "success" | "failed" | "cancelled";

type ProgressParams = {
  songTitle: string;
  fileSizeMB: number;
  progressPercent: number;
};

let cancelHandler: (() => boolean | void) | null = null;
let userCancelled = false;
let eventsRegistered = false;
let currentPhase: Phase = "idle";
let hideTimers: ReturnType<typeof setTimeout>[] = [];

let progressFirstShownAt = 0;
let lastProgressAt = 0;
let lastPercent = 0;

let pendingProgress: ProgressParams | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let alertNextProgress = false;

let queue: Promise<void> = Promise.resolve();
const enqueue = (fn: () => Promise<void>): Promise<void> => {
  queue = queue.then(fn).catch((e) => {
    console.warn("[deleteNotif] queue error:", e);
  });
  return queue;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isProgress = notification.request.identifier === PROGRESS_NOTIF_ID;
    let alert = true;
    if (isProgress) {
      alert = alertNextProgress;
      alertNextProgress = false;
    }
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: alert,
      shouldSetBadge: false,
    };
  },
});

const buildTextBar = (percent: number): string => {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * BAR_LENGTH);
  return "━".repeat(filled) + "─".repeat(Math.max(0, BAR_LENGTH - filled));
};

const formatSize = (mb: number) => {
  if (mb > 0) return `${mb.toFixed(2)}MB`;
  return "Unknown size";
};

const dismissById = async (id: string): Promise<void> => {
  try { await Notifications.dismissNotificationAsync(id); } catch {}
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
};

const clearHideTimers = (): void => {
  hideTimers.forEach((t) => clearTimeout(t));
  hideTimers = [];
};

const clearFlush = (): void => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  pendingProgress = null;
};

const clearProgressNow = async (): Promise<void> => {
  await dismissById(WAITING_NOTIF_ID);
  await dismissById(PROGRESS_NOTIF_ID);
  await sleep(150);
  await dismissById(PROGRESS_NOTIF_ID);
  progressFirstShownAt = 0;
};

const postProgressNow = async (params: ProgressParams): Promise<void> => {
  const percent = Math.max(0, Math.min(100, Math.round(params.progressPercent)));
  const sizeStr = formatSize(params.fileSizeMB);

  const content: any = {
    subtitle: `${percent}% of ${sizeStr}`,
    title: params.songTitle,
    body: buildTextBar(percent),
    autoDismiss: false,
    sticky: true,
    categoryIdentifier: CANCEL_CATEGORY,
    data: { kind: "delete-progress" },
  };

  if (Platform.OS === "android") {
    content.channelId = CHANNEL_ID;
  }

  if (!progressFirstShownAt) alertNextProgress = true;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: PROGRESS_NOTIF_ID,
      content,
      trigger: null,
    });
    if (!progressFirstShownAt) progressFirstShownAt = Date.now();
    lastProgressAt = Date.now();
    lastPercent = percent;
  } catch (e) {
    console.warn("[deleteNotif] progress failed:", e);
  }
};

const flushPending = (): void => {
  flushTimer = null;
  const p = pendingProgress;
  pendingProgress = null;
  if (!p) return;
  enqueue(async () => {
    if (currentPhase !== "progress") return;
    await postProgressNow(p);
  });
};

export const setupDeleteNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Song Deletion",
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      enableVibrate: true,
      vibrationPattern: [0, 120],
    });

    await Notifications.setNotificationCategoryAsync(CANCEL_CATEGORY, [
      {
        identifier: "cancel-delete",
        buttonTitle: "Cancel",
        options: { opensAppToForeground: false, isDestructive: false },
      },
    ]);
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
    
    if (typeof fn === "function") {
      const actuallyCancelled = fn();
      if (actuallyCancelled === false) return;
    }

    cancelHandler = null;
    userCancelled = true;
    currentPhase = "cancelled";
    clearHideTimers();
    clearFlush();

    await enqueue(clearProgressNow);
  });
};

export const isDeleteCancelled = (): boolean => userCancelled;

export const showDeleteWaiting = async (params: {
  songTitle: string;
  fileSizeMB: number;
  onCancel: () => boolean | void;
}): Promise<void> => {
  if (currentPhase === "success" || currentPhase === "failed" || currentPhase === "cancelled") return;

  currentPhase = "progress";
  cancelHandler = params.onCancel;
  const sizeStr = formatSize(params.fileSizeMB);

  // ✅ मोबाईलचे नाव (डिव्हाइस नेम) मिळवणे
  const deviceName = Device.deviceName || Device.modelName || "device";

  const content: any = {
    subtitle: sizeStr,
    title: params.songTitle,
    body: `Waiting for ${deviceName} to accept...`,
    autoDismiss: false,
    sticky: true,
    categoryIdentifier: CANCEL_CATEGORY,
    data: { kind: "delete-waiting" },
  };
  
  if (Platform.OS === "android") content.channelId = CHANNEL_ID;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: WAITING_NOTIF_ID,
      content,
      trigger: null,
    });
  } catch (e) {
    console.warn("[deleteNotif] waiting failed:", e);
  }
};

export const showDeleteProgress = async (params: {
  songTitle: string;
  fileSizeMB: number;
  progressPercent: number;
  onCancel: () => boolean | void;
}): Promise<void> => {
  if (currentPhase === "success" || currentPhase === "failed" || currentPhase === "cancelled") return;

  currentPhase = "progress";
  cancelHandler = params.onCancel;

  const p: ProgressParams = {
    songTitle: params.songTitle,
    fileSizeMB: params.fileSizeMB,
    progressPercent: params.progressPercent,
  };

  if (!progressFirstShownAt) {
    clearFlush();
    await enqueue(async () => {
      if (currentPhase !== "progress") return;
      await dismissById(WAITING_NOTIF_ID);
      await postProgressNow(p);
    });
    return;
  }

  pendingProgress = p;
  if (flushTimer) return;

  const wait = Math.max(0, MIN_PROGRESS_INTERVAL_MS - (Date.now() - lastProgressAt));
  flushTimer = setTimeout(flushPending, wait);
};

export const showDeleteSuccess = async (params: {
  songTitle: string;
  fileSizeMB: number;
}): Promise<void> => {
  currentPhase = "success";
  cancelHandler = null;
  clearFlush();

  await enqueue(async () => {
    await dismissById(WAITING_NOTIF_ID);

    if (!progressFirstShownAt) {
      await postProgressNow({ ...params, progressPercent: 0 });
      await sleep(300);
    }

    let p = lastPercent;
    const remaining = 100 - p;
    if (remaining > 0) {
      const steps = Math.max(1, Math.ceil(remaining / FILL_STEP_PERCENT));
      const stepMs = Math.min(
        FILL_STEP_MAX_MS,
        Math.max(FILL_STEP_MIN_MS, Math.round(MIN_PROGRESS_VISIBLE_MS / steps)),
      );
      for (let i = 1; i <= steps; i++) {
        p = Math.min(100, lastPercent + FILL_STEP_PERCENT);
        if (i === steps) p = 100;
        await postProgressNow({ ...params, progressPercent: p });
        await sleep(stepMs);
      }
    } else {
      await postProgressNow({ ...params, progressPercent: 100 });
    }

    await sleep(COMPLETE_HOLD_MS);
    await clearProgressNow();

    const sizeStr = formatSize(params.fileSizeMB);

    // ✅ येथे डिव्हाइसचे नाव मिळवले आहे
    const deviceName = Device.deviceName || Device.modelName || "device";

    const content: any = {
      subtitle: sizeStr,
      title: params.songTitle,
      // ✅ "Delete song from [Device Name]" असे दिसेल
      body: `Delete song from ${deviceName}`,
      autoDismiss: false,
      sticky: true,
      data: { kind: "delete-success" },
    };

    if (Platform.OS === "android") content.channelId = CHANNEL_ID;

    const uniqueSuccessId = `${SUCCESS_PREFIX}${Date.now()}`;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: uniqueSuccessId,
        content,
        trigger: null,
      });
    } catch (e) {
      console.warn("[deleteNotif] success failed:", e);
    }
  });
};

export const showDeleteFailed = async (params: {
  songTitle: string;
  fileSizeMB: number;
  reason?: string;
}): Promise<void> => {
  clearFlush();

  if (userCancelled || currentPhase === "cancelled") {
    await enqueue(clearProgressNow);
    return;
  }

  currentPhase = "failed";
  cancelHandler = null;

  await enqueue(async () => {
    await clearProgressNow();

    const sizeStr = formatSize(params.fileSizeMB);
    const content: any = {
      subtitle: `Delete failed • ${sizeStr}`,
      title: params.songTitle,
      body: buildTextBar(100),
      autoDismiss: false,
      sticky: true,
      data: { kind: "delete-failed", reason: params.reason ?? "" },
    };
    if (Platform.OS === "android") content.channelId = CHANNEL_ID;

    const uniqueFailedId = `${FAILED_PREFIX}${Date.now()}`;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: uniqueFailedId,
        content,
        trigger: null,
      });
    } catch (e) {}
  });
};

export const dismissDeleteNotification = async (): Promise<void> => {
  clearHideTimers();
  clearFlush();
  currentPhase = "idle";
  cancelHandler = null;
  userCancelled = false;
  progressFirstShownAt = 0;
  lastProgressAt = 0;
  lastPercent = 0;
  alertNextProgress = false;

  await enqueue(async () => {
    await dismissById(WAITING_NOTIF_ID);
    await dismissById(PROGRESS_NOTIF_ID);
  });
};