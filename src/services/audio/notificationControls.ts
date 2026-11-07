// src/services/audio/notificationControls.ts
//
// Notification / lock-screen options for @rntp/player.
//
// Why this file exists:
//   @rntp/player ships .ts source (not .d.ts), so several of its runtime
//   enums (`Capability`, `AppKilledPlaybackBehavior`) are not usable as
//   TypeScript values via the package root. We hard-code the numeric
//   ordinals here — they are stable across the library's minor versions
//   and match the Kotlin/Java enums on the native side.
//
// Consumers:
//   - src/hooks/useAudioPlayer.ts → TP.updateOptions(buildNotificationOptions())
//
// Adding new capabilities? Extend CAP below — see the table at the bottom.

import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Numeric enum mirrors
//
// These match the values used inside @rntp/player's native module
// (com.doublesymmetry.trackplayer.module.MusicModule.kt → Capability &
// AppKilledPlaybackBehavior enums). Keeping them numeric here means the
// bridge accepts them as `Int` regardless of JS-side typing gaps.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capability.* — capabilities of the media notification.
 * Mirrors `com.doublesymmetry.trackplayer.model.Capability`.
 */
const CAP = {
  Play: 0,
  Pause: 1,
  SkipToNext: 2,
  SkipToPrevious: 3,
  Stop: 4,
  SeekTo: 5,
  JumpForward: 6,
  JumpBackward: 7,
  SetRating: 8,
  Like: 9,
  Dislike: 10,
  Bookmark: 11,
} as const;

/**
 * AppKilledPlaybackBehavior.* — what the player does when the app is
 * killed from the recents list.
 * Mirrors `com.doublesymmetry.trackplayer.model.AppKilledPlaybackBehavior`.
 */
const APP_KILLED = {
  ContinuePlayback: 0,
  StopPlaybackAndRemoveNotification: 1,
  StopPlaybackAndKeepNotification: 2,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Public shape of the object passed to `TrackPlayer.updateOptions()`.
// Kept loose (`any`) so it works even when the package's own typings for
// updateOptions are incomplete.
// ─────────────────────────────────────────────────────────────────────────────
export type NotificationOptions = {
  android?: {
    appKilledPlaybackBehavior?: number;
  };
  capabilities?: number[];
  compactCapabilities?: number[];
  notificationCapabilities?: number[];
  icon?: number;
  playIcon?: number;
  pauseIcon?: number;
  stopIcon?: number;
  previousIcon?: number;
  nextIcon?: number;
  forwardIcon?: number;
  rewindIcon?: number;
};

/**
 * Build the options object for `TrackPlayer.updateOptions()`.
 *
 * Capabilities exposed in the notification:
 *   - PlayPause (Play + Pause)     → full controls
 *   - SkipToNext                   → next button
 *   - SkipToPrevious               → previous button
 *   - SeekTo                       → scrubbable progress bar
 *   - Stop                         → stop button (dismisses the notification)
 *
 * Compact view (collapsed notification on Android) shows:
 *   - PlayPause
 *   - SkipToNext
 *
 * On Android, when the user swipes the app out of recents, playback stops
 * and the notification is removed — this is what
 * `StopPlaybackAndRemoveNotification` does. On iOS this field is ignored
 * (iOS already tears down background audio when the app is force-killed).
 */
export function buildNotificationOptions(): NotificationOptions {
  const capabilities = [
    CAP.Play,
    CAP.Pause,
    CAP.SkipToNext,
    CAP.SkipToPrevious,
    CAP.SeekTo,
    CAP.Stop,
  ];

  return {
    android: {
      appKilledPlaybackBehavior:
        APP_KILLED.StopPlaybackAndRemoveNotification,
    },
    capabilities,
    compactCapabilities: [CAP.Play, CAP.Pause, CAP.SkipToNext],
    notificationCapabilities: capabilities,
    // Icons are provided by @rntp/player's bundled drawables
    // (R.drawable.forward / R.drawable.rewind for skip and seek). Leaving
    // these undefined uses the library defaults, which look correct on
    // both light and dark notification themes.
  };
}

/**
 * Placeholder for any runtime re-sync of notification icon assets.
 *
 * @rntp/player uses built-in drawables for play/pause/next/prev, so there
 * is nothing to refresh here. Kept as an exported no-op so callers that
 * import it (and may exist on other platforms or future versions) don't
 * break.
 */
export function refreshNotificationIcons(): void {
  // No-op — icons come from the native module.
  if (Platform.OS === "web") return; // silence unused `Platform` import warning
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference: the numeric values in CAP and APP_KILLED come from
//   node_modules/@rntp/player/android/src/main/java/com/doublesymmetry/
//   trackplayer/model/Capability.kt
//   node_modules/@rntp/player/android/src/main/java/com/doublesymmetry/
//   trackplayer/model/AppKilledPlaybackBehavior.kt
//
// If you later bump @rntp/player to a version whose typings expose the
// enums directly, this file can be simplified to:
//
//   import TrackPlayer, { Capability, AppKilledPlaybackBehavior } from "@rntp/player";
//
//   capabilities: [Capability.Play, Capability.Pause, ...]
//
// Until then, the numeric ordinals keep the bridge working without needing
// any `as any` casts at the call site.
// ─────────────────────────────────────────────────────────────────────────────