// src/hooks/useLiveActivity.tsx
// iOS  → system Live Activity / Dynamic Island (expo-widgets)
// Android → nothing custom: the SYSTEM media notification from @rntp/player is used.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import type { LiveActivity } from "expo-widgets"; // type only – erased at build time
import { usePlayerStore } from "../store/playerStore";

export type NowPlayingData = {
  title: string;
  artist: string;
  isPlaying: boolean;
  progress: number; // 0 to 1
};

// iOS Live Activity factory is loaded ONLY on iOS
function getIosActivity(): any {
  if (Platform.OS !== "ios") return null;
  try {
    return require("./musicLiveActivityIos").MusicLiveActivity;
  } catch (e) {
    console.log("[LiveActivity] iOS module load failed:", e);
    return null;
  }
}

// ───────────────────────── Low-level start / update / stop (iOS) ─────────────────────────
export function useLiveActivity() {
  const iosInstance = useRef<LiveActivity<NowPlayingData> | null>(null);
  const iosStarting = useRef<Promise<void> | null>(null);

  const update = useCallback(async (data: NowPlayingData) => {
    if (Platform.OS !== "ios") return;
    try {
      if (iosStarting.current) await iosStarting.current;
      await iosInstance.current?.update(data);
    } catch (e) {
      console.log("[LiveActivity] iOS update failed:", e);
    }
  }, []);

  const start = useCallback(
    async (data: NowPlayingData) => {
      if (Platform.OS !== "ios") return;
      // Never start a second activity – reuse the running one
      if (iosInstance.current || iosStarting.current) {
        await update(data);
        return;
      }
      const factory = getIosActivity();
      if (!factory) return;
      iosStarting.current = (async () => {
        try {
          iosInstance.current = await factory.start(data);
        } catch (e) {
          console.log("[LiveActivity] iOS start failed:", e);
        } finally {
          iosStarting.current = null;
        }
      })();
      await iosStarting.current;
    },
    [update],
  );

  const stop = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      if (iosStarting.current) await iosStarting.current;
      if (iosInstance.current) {
        await iosInstance.current.end("default");
        iosInstance.current = null;
      }
    } catch (e) {
      console.log("[LiveActivity] iOS stop failed:", e);
    }
  }, []);

  return useMemo(() => ({ start, update, stop }), [start, update, stop]);
}

// ───────────────────────── Mount ONCE in App.tsx ─────────────────────────
export function useLiveActivitySync() {
  const api = useLiveActivity();
  const apiRef = useRef(api);
  apiRef.current = api;

  const trackId = usePlayerStore((s) => s.currentTrack?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const active = useRef(false);

  const snapshot = useCallback((): NowPlayingData | null => {
    const { currentTrack, isPlaying, position, duration } =
      usePlayerStore.getState();
    if (!currentTrack) return null;
    const progress =
      duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
    return {
      title: currentTrack.title || "Unknown Title",
      artist: currentTrack.artist || "Unknown Artist",
      isPlaying,
      progress,
    };
  }, []);

  // Track change or play/pause change → start / update / stop
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const data = snapshot();
    if (!data) {
      if (active.current) {
        active.current = false;
        apiRef.current.stop();
      }
      return;
    }
    if (!active.current) {
      active.current = true;
      apiRef.current.start(data);
    } else {
      apiRef.current.update(data);
    }
  }, [trackId, isPlaying, snapshot]);

  // Progress refresh every 15 s (iOS throttles frequent Live Activity updates)
  useEffect(() => {
    if (Platform.OS !== "ios" || !isPlaying) return;
    const timer = setInterval(() => {
      const data = snapshot();
      if (data && active.current) apiRef.current.update(data);
    }, 15000);
    return () => clearInterval(timer);
  }, [isPlaying, snapshot]);

  // End the activity when the app root unmounts
  useEffect(() => {
    return () => {
      active.current = false;
      apiRef.current.stop();
    };
  }, []);
}
