// src/services/audio/playerSetup.ts
import {
  getTrackPlayer,
  isTrackPlayerAvailable,
} from "./trackPlayerSafe";
import { buildNotificationOptions } from "./notificationControls";

const TrackPlayerRuntime: any = require("@rntp/player");

const AppKilledPlaybackBehavior: any =
  TrackPlayerRuntime.AppKilledPlaybackBehavior ?? {
    ContinuePlayback: 0,
    PausePlayback: 1,
    StopPlaybackAndRemoveNotification: 2,
  };

let isSetup = false;
let setupPromise: Promise<void> | null = null;
let optionsApplied = false;

export async function ensurePlayerSetup(): Promise<void> {
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    const TP = getTrackPlayer();

    if (!isSetup) {
      try {
        await TP.setupPlayer({
          contentType: "music",
          autoHandleInterruptions: true,
          handleAudioBecomingNoisy: true,
          android: {
            taskRemovedBehavior: "continue",
            appKilledPlaybackBehavior:
              AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          },
        });
        isSetup = true;
      } catch (error: any) {
        const message = String(error?.message ?? error).toLowerCase();
        if (
          message.includes("already been initialized") ||
          message.includes("already initialized") ||
          message.includes("player already initialized")
        ) {
          isSetup = true;
        } else {
          throw error;
        }
      }
    }

    // v5 uses setMediaItems. Accept add/setQueue for older builds too.
    const hasSetMediaItems = typeof TP.setMediaItems === "function";
    const hasAdd = typeof TP.add === "function";
    const hasSetQueue = typeof TP.setQueue === "function";

    if (!hasSetMediaItems && !hasAdd && !hasSetQueue) {
      throw new Error(
        "@rntp/player: native module has no queue API. " +
          "Set newArchEnabled=true in app.json and rebuild.",
      );
    }

    if (!optionsApplied) {
      try {
        if (typeof TP.updateOptions === "function") {
          await TP.updateOptions(buildNotificationOptions());
          console.log("[Notification] Options configured");
        }
        optionsApplied = true;
      } catch (e) {
        console.warn("[Notification] updateOptions failed:", e);
        optionsApplied = true;
      }
    }
  })();

  try {
    await setupPromise;
  } catch (error) {
    setupPromise = null;
    optionsApplied = false;
    throw error;
  }
}

export async function waitForPlayerSetup(): Promise<void> {
  if (!isTrackPlayerAvailable()) {
    throw new Error("TrackPlayer native module is unavailable.");
  }
  await ensurePlayerSetup();
}

export async function pushQueue(TP: any, items: any[]): Promise<void> {
  if (typeof TP.setMediaItems === "function") {
    await TP.setMediaItems(items, 0);
    return;
  }
  if (typeof TP.add === "function") {
    await TP.add(items);
    return;
  }
  if (typeof TP.setQueue === "function") {
    await TP.setQueue(items);
    return;
  }
  throw new Error("RNTP: no queue API available.");
}