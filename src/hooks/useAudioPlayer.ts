import { useCallback, useEffect, useRef, useState } from "react";
import { RepeatMode } from "@rntp/player";
import { usePlayerStore } from "../store/playerStore";
import { Song } from "../types";
import {
  getTrackPlayer,
  getTrackPlayerEnums,
  isTrackPlayerAvailable,
} from "../services/audio/trackPlayerSafe";
import { songToMediaItem } from "../services/audio/mediaItem";

type PlayingResult =
  | boolean
  | { playing: boolean; bufferingDuringPlay?: boolean };

interface SafeHooks {
  useIsPlaying: () => PlayingResult;
  useProgress: (interval?: number) => {
    position: number;
    duration: number;
    buffered: number;
  };
  useActiveMediaItem: () => any;
}

function getSafeHooks(): SafeHooks {
  const fallback: SafeHooks = {
    useIsPlaying: () => false,
    useProgress: () => ({ position: 0, duration: 0, buffered: 0 }),
    useActiveMediaItem: () => null,
  };

  if (!isTrackPlayerAvailable()) return fallback;

  try {
    const mod = require("@rntp/player");
    return {
      useIsPlaying: mod.useIsPlaying ?? fallback.useIsPlaying,
      useProgress: mod.useProgress ?? fallback.useProgress,
      useActiveMediaItem: mod.useActiveMediaItem ?? fallback.useActiveMediaItem,
    };
  } catch (error) {
    console.error("[useAudioPlayer] Hook loading failed:", error);
    return fallback;
  }
}

const toNativeRepeat = (mode: "off" | "queue" | "track") =>
  mode === "track"
    ? RepeatMode.One
    : mode === "queue"
      ? RepeatMode.All
      : RepeatMode.Off;

// v5: getProgress() is synchronous. Falls back to the old calls / store.
function readPosition(TP: any): number {
  try {
    if (typeof TP.getProgress === "function") {
      const p = TP.getProgress();
      if (p && typeof p.position === "number") return p.position;
    }
    if (typeof TP.getPosition === "function") {
      const v = Number(TP.getPosition());
      if (Number.isFinite(v)) return v;
    }
  } catch {}
  return usePlayerStore.getState().position;
}

function readDuration(TP: any): number {
  try {
    if (typeof TP.getProgress === "function") {
      const p = TP.getProgress();
      if (p && typeof p.duration === "number") return p.duration;
    }
    if (typeof TP.getDuration === "function") {
      const v = Number(TP.getDuration());
      if (Number.isFinite(v)) return v;
    }
  } catch {}
  return usePlayerStore.getState().duration;
}

// ===========================================================================
// Module-level shared state (shared by EVERY useAudioPlayer() call)
// ===========================================================================

// If skipping inside the existing native queue misbehaves on your build,
// set this to false. Next/prev will then rebuild the queue like before.
const USE_SKIP = true;

// How long we ignore "old song is still active" reports after a switch.
const PENDING_MS = 3000;

// Id of the song we just asked native to play. Until native reports this id
// (or PENDING_MS passes) every other "active track" report is stale.
let pendingId: string | null = null;
let pendingUntil = 0;

const setPending = (id: string | number | undefined) => {
  pendingId = id != null ? String(id) : null;
  pendingUntil = Date.now() + PENDING_MS;
};

const isPending = (): boolean => {
  if (!pendingId) return false;
  if (Date.now() > pendingUntil) {
    pendingId = null;
    return false;
  }
  return true;
};

/** true => this report is stale and must be ignored */
const shouldIgnoreDetected = (id: string | undefined): boolean => {
  if (!isPending()) return false;
  if (id != null && id === pendingId) {
    pendingId = null; // native caught up
    return false;
  }
  return true;
};

// Every click gets a token; older async work is dropped.
let playToken = 0;

// Which queue (by song ids) the native player currently holds.
let nativeQueueSig = "";
const queueSig = (songs: Song[]) => songs.map((s) => String(s.id)).join("|");

// Let React draw the new song / icons BEFORE the heavy native work starts.
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Converting a whole queue on every click is slow; convert each song once.
const mediaItemCache = new WeakMap<object, any>();
const toMediaItems = (songs: Song[]) =>
  songs.map((song) => {
    let item = mediaItemCache.get(song);
    if (!item) {
      item = songToMediaItem(song);
      mediaItemCache.set(song, item);
    }
    return item;
  });

// Only ONE hook instance runs the sync effects (detection, progress, etc).
// If it unmounts, the next one takes over.
let instanceCounter = 0;
let ownerId: number | null = null;
const waiters = new Map<number, (isOwner: boolean) => void>();

function registerInstance(id: number, cb: (isOwner: boolean) => void) {
  waiters.set(id, cb);
  if (ownerId === null) {
    ownerId = id;
    cb(true);
  } else {
    cb(false);
  }
  return () => {
    waiters.delete(id);
    if (ownerId === id) {
      ownerId = null;
      const first = waiters.entries().next().value as
        | [number, (o: boolean) => void]
        | undefined;
      if (first) {
        ownerId = first[0];
        first[1](true);
      }
    }
  };
}

export function useAudioPlayer() {
  const { useIsPlaying, useProgress, useActiveMediaItem } = getSafeHooks();

  const playingResult = useIsPlaying();
  const playing =
    typeof playingResult === "boolean" ? playingResult : playingResult.playing;

  // Progress — updates every 500ms
  const { position, duration } = useProgress(0.5);
  const activeTrack = useActiveMediaItem();

  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setCurrentIndex = usePlayerStore((s) => s.setCurrentIndex);

  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);

  // ---- owner election: only one instance runs the sync effects ----
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = ++instanceCounter;
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => registerInstance(idRef.current, setIsOwner), []);

  // NOTE: Live Activity / Dynamic Island is NOT handled here.
  // It is mounted once in App.tsx via useLiveActivitySync().
  // The system media card / status-bar pill metadata is kept fresh by
  // useMediaSessionSync() (also mounted in App.tsx).

  // ---- 1. playing state sync ----
  useEffect(() => {
    if (!isOwner) return;
    // While switching songs native briefly reports "not playing"; ignore it
    // so the UI doesn't flicker pause -> play.
    if (!playing && isPending()) return;
    setPlaying(playing);
  }, [isOwner, playing, setPlaying]);

  // ---- 2. progress sync ----
  useEffect(() => {
    if (!isOwner) return;
    // Old song's position must not overwrite the 0 we set for the new song.
    if (isPending()) return;
    setProgress(position, duration);
  }, [isOwner, position, duration, setProgress]);

  // ---- 3. TRACK CHANGE DETECTION (one instance only) ----
  useEffect(() => {
    if (!isOwner) return;
    if (!isTrackPlayerAvailable()) return;

    const TP = getTrackPlayer();
    if (!TP) return;

    let alive = true;
    let running = false;

    const syncTrack = async () => {
      if (!alive || running) return;
      running = true;

      try {
        const store = usePlayerStore.getState();
        const q = store.queue;
        const ci = store.currentIndex;

        if (q.length === 0) return;

        let activeId: string | undefined;
        let activeIndex: number | undefined;

        // v5 item field is `mediaId` (older builds used `id`)
        if (typeof TP.getActiveMediaItem === "function") {
          try {
            const item = await TP.getActiveMediaItem();
            if (item) {
              const mid = item.mediaId ?? item.id;
              if (mid != null) activeId = String(mid);
              if (typeof item.index === "number") activeIndex = item.index;
            }
          } catch {}
        }

        if (!activeId && typeof TP.getActiveTrack === "function") {
          try {
            const t = await TP.getActiveTrack();
            const mid = t?.mediaId ?? t?.id;
            if (mid != null) activeId = String(mid);
          } catch {}
        }

        if (
          activeIndex == null &&
          typeof TP.getActiveMediaItemIndex === "function"
        ) {
          try {
            const r = await TP.getActiveMediaItemIndex();
            if (typeof r === "number") activeIndex = r;
          } catch {}
        }

        if (activeIndex == null && typeof TP.getCurrentIndex === "function") {
          try {
            const r = await TP.getCurrentIndex();
            if (typeof r === "number") activeIndex = r;
          } catch {}
        }

        if (!alive) return;

        // Work out which song native says is active.
        let reportedIndex = -1;
        if (activeIndex != null && activeIndex >= 0 && activeIndex < q.length) {
          reportedIndex = activeIndex;
        } else if (activeId) {
          reportedIndex = q.findIndex((s) => String(s.id) === activeId);
        }
        if (reportedIndex < 0) return;

        const reportedSongId = String(q[reportedIndex]?.id);

        // Stale report from the previous song during a switch -> ignore.
        if (shouldIgnoreDetected(reportedSongId)) return;

        // Re-read the store (it may have changed while we awaited).
        const latest = usePlayerStore.getState();
        if (reportedIndex !== latest.currentIndex) {
          console.log(
            `[TrackDetect] index ${latest.currentIndex} → ${reportedIndex} :`,
            latest.queue[reportedIndex]?.title,
          );
          latest.setCurrentIndex(reportedIndex);
        }
      } catch {
        // ignore
      } finally {
        running = false;
      }
    };

    const interval = setInterval(syncTrack, 1000);
    const warmup = setTimeout(syncTrack, 300);

    const E = getTrackPlayerEnums();
    let sub: any = null;
    if (typeof TP.addEventListener === "function" && E?.Event) {
      try {
        const evName = E.Event.PlaybackActiveTrackChanged;
        if (evName) {
          sub = TP.addEventListener(evName, () => {
            syncTrack();
          });
        }
      } catch {}
    }

    return () => {
      alive = false;
      clearTimeout(warmup);
      clearInterval(interval);
      try {
        if (sub && typeof sub.remove === "function") sub.remove();
      } catch {}
    };
  }, [isOwner]);

  // ---- 4. activeTrack hook fallback (one instance only) ----
  useEffect(() => {
    if (!isOwner) return;
    const aid = activeTrack?.mediaId ?? activeTrack?.id;
    if (!aid) return;

    // Stale "old song is still active" report while switching -> ignore.
    if (shouldIgnoreDetected(String(aid))) return;

    const idx = queue.findIndex((s) => String(s.id) === String(aid));
    if (idx >= 0 && idx !== currentIndex) {
      console.log("[TrackDetect:hook] →", idx, queue[idx]?.title);
      setCurrentIndex(idx);
    }
  }, [
    isOwner,
    activeTrack?.mediaId,
    activeTrack?.id,
    queue,
    currentIndex,
    setCurrentIndex,
  ]);

  // ---- 5. Safety net: auto-play next song when the current one ends ----
  const nextRef = useRef<() => Promise<void>>(async () => {});
  const endHandledRef = useRef<string | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    if (!isTrackPlayerAvailable()) return;
    if (!duration || duration <= 1) return;
    if (isPending()) return;

    const store = usePlayerStore.getState();
    const track = store.queue[store.currentIndex];
    if (!track) return;

    const key = `${store.currentIndex}:${track.id}`;

    if (position < duration - 3) {
      if (endHandledRef.current === key) endHandledRef.current = null;
      return;
    }

    if (position < duration - 0.6) return;
    if (endHandledRef.current === key) return;
    if (store.repeat === "track") return;
    endHandledRef.current = key;

    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = setTimeout(() => {
      const s = usePlayerStore.getState();
      const cur = s.queue[s.currentIndex];
      if (!cur || `${s.currentIndex}:${cur.id}` !== key) return;
      void nextRef.current();
    }, 1500);
  }, [isOwner, position, duration]);

  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, []);

  // ---- loadAndPlay ----
  const loadAndPlay = useCallback(
    async (songs: Song[], startIndex: number): Promise<void> => {
      if (!songs.length) throw new Error("Playback queue is empty.");
      if (startIndex < 0 || startIndex >= songs.length) {
        throw new Error(`Invalid song index: ${startIndex}`);
      }
      if (!songs[startIndex]?.uri) {
        throw new Error("Selected song has no audio URI.");
      }
      if (!isTrackPlayerAvailable()) {
        throw new Error("TrackPlayer native module is unavailable.");
      }

      const TP = getTrackPlayer();
      const token = ++playToken;

      try {
        if (typeof TP.setMediaItems !== "function") {
          throw new Error("RNTP V5 setMediaItems() is unavailable.");
        }

        // Update the UI instantly and protect it from stale native reports.
        setPending(songs[startIndex].id);
        setQueue(songs, startIndex);
        setProgress(0, songs[startIndex].duration || 0);
        setPlaying(true); // optimistic: controller icons show instantly
        await nextFrame(); // let the mini player render first

        if (token !== playToken) return;
        await TP.setMediaItems(toMediaItems(songs), startIndex);
        nativeQueueSig = queueSig(songs);

        // A newer click happened while we were loading -> drop this one.
        if (token !== playToken) return;

        await TP.play();
        if (token !== playToken) return;
        setPlaying(true);

        console.log("[loadAndPlay] Playing:", songs[startIndex].title);
      } catch (error) {
        if (token === playToken) {
          pendingId = null;
          setPlaying(false);
        }
        console.error("[loadAndPlay] Failed:", error);
        throw error;
      }
    },
    [setQueue, setProgress, setPlaying],
  );

  const playPause = useCallback(async () => {
    if (!isTrackPlayerAvailable()) return;
    const TP = getTrackPlayer();

    try {
      const actualPlaying =
        typeof TP.isPlaying === "function"
          ? TP.isPlaying()
          : usePlayerStore.getState().isPlaying;

      if (actualPlaying) {
        await TP.pause();
        setPlaying(false);
      } else {
        await TP.play();
        setPlaying(true);
      }
    } catch (error) {
      console.error("[playPause] Failed:", error);
    }
  }, [setPlaying]);

  const playIndex = useCallback(
    async (targetIndex: number) => {
      if (!isTrackPlayerAvailable()) return;

      const state = usePlayerStore.getState();
      const songs = state.queue;

      if (
        targetIndex < 0 ||
        targetIndex >= songs.length ||
        !songs[targetIndex]?.uri
      ) {
        return;
      }

      const TP = getTrackPlayer();
      const token = ++playToken;

      try {
        // Update the UI instantly and protect it from stale native reports.
        setPending(songs[targetIndex].id);
        setCurrentIndex(targetIndex);
        setProgress(0, songs[targetIndex].duration || 0);
        setPlaying(true); // optimistic: controller icons show instantly
        await nextFrame(); // let the UI render first

        if (token !== playToken) return;
        const sig = queueSig(songs);
        let skipped = false;

        // Fast path: native already holds this exact queue -> just skip.
        if (USE_SKIP && sig === nativeQueueSig) {
          for (const fn of ["skipToIndex", "skipTo"]) {
            if (typeof TP[fn] === "function") {
              try {
                await TP[fn](targetIndex);
                skipped = true;
                break;
              } catch {
                // try the next name / fall back to setMediaItems
              }
            }
          }
        }

        if (!skipped) {
          if (typeof TP.setMediaItems !== "function") {
            throw new Error("RNTP V5 setMediaItems() is unavailable.");
          }
          await TP.setMediaItems(toMediaItems(songs), targetIndex);
          nativeQueueSig = sig;
        }

        // A newer click happened while we were loading -> drop this one.
        if (token !== playToken) return;

        await TP.play();
        if (token !== playToken) return;
        setPlaying(true);
      } catch (error) {
        if (token === playToken) {
          pendingId = null;
          setPlaying(false);
        }
        console.error("[playIndex] Failed:", error);
      }
    },
    [setCurrentIndex, setProgress, setPlaying],
  );

  const next = useCallback(async () => {
    const state = usePlayerStore.getState();
    if (state.queue.length === 0) return;
    if (state.currentIndex < state.queue.length - 1) {
      await playIndex(state.currentIndex + 1);
    } else if (state.repeat === "queue") {
      await playIndex(0);
    }
  }, [playIndex]);

  const prev = useCallback(async () => {
    if (!isTrackPlayerAvailable()) return;
    const TP = getTrackPlayer();

    try {
      if (readPosition(TP) > 3) {
        await TP.seekTo(0);
        setProgress(0, usePlayerStore.getState().duration);
        return;
      }

      const state = usePlayerStore.getState();
      if (state.currentIndex > 0) {
        await playIndex(state.currentIndex - 1);
      } else {
        await TP.seekTo(0);
      }
    } catch (error) {
      console.error("[prev] Failed:", error);
    }
  }, [playIndex, setProgress]);

  nextRef.current = next;

  const seek = useCallback(async (value: number) => {
    if (!isTrackPlayerAvailable()) return;
    try {
      await getTrackPlayer().seekTo(value);
    } catch (error) {
      console.error("[seek] Failed:", error);
    }
  }, []);

  const seekBy = useCallback(async (delta: number) => {
    if (!isTrackPlayerAvailable()) return;
    const TP = getTrackPlayer();

    try {
      const pos = readPosition(TP);
      const dur = readDuration(TP);
      await TP.seekTo(Math.max(0, Math.min(dur, pos + delta)));
    } catch (error) {
      console.error("[seekBy] Failed:", error);
    }
  }, []);

  // Needed by useCrossfade (it was never returned before, so crossfade
  // silently did nothing).
  const setVolume = useCallback(async (value: number) => {
    if (!isTrackPlayerAvailable()) return;
    try {
      const TP = getTrackPlayer();
      if (typeof TP.setVolume === "function") {
        await TP.setVolume(Math.max(0, Math.min(1, value)));
      }
    } catch (error) {
      console.error("[setVolume] Failed:", error);
    }
  }, []);

  const toggleShuffle = useCallback(async () => {
    const state = usePlayerStore.getState();
    const nextShuffle = !state.shuffle;
    state.setShuffle(nextShuffle);

    const songs = [...state.queue];
    const currentSong = songs[state.currentIndex];

    if (nextShuffle) {
      for (let i = songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songs[i], songs[j]] = [songs[j], songs[i]];
      }
    }

    const nextIndex = Math.max(
      0,
      currentSong ? songs.findIndex((song) => song.id === currentSong.id) : 0,
    );

    setQueue(songs, nextIndex);

    // Keep the native player's queue in the same order as the app's queue.
    if (!isTrackPlayerAvailable()) return;
    const TP = getTrackPlayer();
    try {
      if (typeof TP.setMediaItems !== "function" || songs.length === 0) return;

      const wasPlaying = usePlayerStore.getState().isPlaying;
      const pos = readPosition(TP);

      // Same song stays current, so no stale-report guard is needed, but the
      // native queue order changes, so remember the new signature.
      await TP.setMediaItems(toMediaItems(songs), nextIndex);
      nativeQueueSig = queueSig(songs);
      if (pos > 0 && typeof TP.seekTo === "function") await TP.seekTo(pos);
      if (wasPlaying) await TP.play();
      else if (typeof TP.pause === "function") await TP.pause();
    } catch (error) {
      console.error("[toggleShuffle] Failed to sync native queue:", error);
    }
  }, [setQueue]);

  const cycleRepeat = useCallback(async () => {
    const state = usePlayerStore.getState();
    const modes: Array<"off" | "queue" | "track"> = ["off", "queue", "track"];
    const nextMode = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
    state.setRepeat(nextMode);

    if (!isTrackPlayerAvailable()) return;
    const TP = getTrackPlayer();
    try {
      if (typeof TP.setRepeatMode === "function") {
        await TP.setRepeatMode(toNativeRepeat(nextMode));
      }
    } catch (error) {
      console.error("[cycleRepeat] Failed:", error);
    }
  }, []);

  return {
    isPlaying: playing,
    position,
    duration,
    loadAndPlay,
    playPause,
    next,
    prev,
    seek,
    seekBy,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  };
}
