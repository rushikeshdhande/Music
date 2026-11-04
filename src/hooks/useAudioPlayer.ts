import { useCallback, useEffect, useRef, useState } from "react";
import { RepeatMode, State, Capability } from "react-native-track-player";
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
    const mod = require("react-native-track-player");
    return {
      useIsPlaying: () => {
        try {
          const state = mod.usePlaybackState();
          return state.state === mod.State.Playing;
        } catch {
          return false;
        }
      },
      useProgress: mod.useProgress ?? fallback.useProgress,
      useActiveMediaItem: mod.useActiveTrack ?? fallback.useActiveMediaItem,
    };
  } catch (error) {
    console.error("[useAudioPlayer] Hook loading failed:", error);
    return fallback;
  }
}

const toNativeRepeat = (mode: "off" | "queue" | "track") =>
  mode === "track"
    ? RepeatMode.Track
    : mode === "queue"
      ? RepeatMode.Queue
      : RepeatMode.Off;

async function readPosition(TP: any): Promise<number> {
  try {
    if (typeof TP.getPosition === "function") {
      const v = Number(await TP.getPosition());
      if (Number.isFinite(v)) return v;
    }
  } catch {}
  return usePlayerStore.getState().position;
}

async function readDuration(TP: any): Promise<number> {
  try {
    if (typeof TP.getDuration === "function") {
      const v = Number(await TP.getDuration());
      if (Number.isFinite(v)) return v;
    }
  } catch {}
  return usePlayerStore.getState().duration;
}

// ===========================================================================
// 🔥 Ensure Player Setup
// ===========================================================================
let isSetup = false;

async function ensurePlayerSetup() {
  if (isSetup) return;
  
  // ✅ FIX: Declare TP outside the try/catch so it's accessible in both blocks
  const TP = getTrackPlayer();

  try {
    // Attempt to get state. If it throws, it's not initialized.
    await TP.getState();
    isSetup = true;
  } catch (err) {
    try {
      await TP.setupPlayer({ autoHandleInterruptions: true });
      await TP.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
      });
      isSetup = true;
    } catch (setupErr: any) {
      if (
        setupErr.message &&
        setupErr.message.includes("already been initialized")
      ) {
        isSetup = true;
      } else {
        console.error("[TrackPlayer] setupPlayer failed", setupErr);
      }
    }
  }
}

// ===========================================================================
// Module-level shared state
// ===========================================================================

const USE_SKIP = true;
const PENDING_MS = 3000;

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

const shouldIgnoreDetected = (id: string | undefined): boolean => {
  if (!isPending()) return false;
  if (id != null && id === pendingId) {
    pendingId = null;
    return false;
  }
  return true;
};

let playToken = 0;
let nativeQueueSig = "";
const queueSig = (songs: Song[]) => songs.map((s) => String(s.id)).join("|");

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

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

  const { position, duration } = useProgress(0.5);
  const activeTrack = useActiveMediaItem();

  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setCurrentIndex = usePlayerStore((s) => s.setCurrentIndex);

  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);

  const idRef = useRef(0);
  if (!idRef.current) idRef.current = ++instanceCounter;
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => registerInstance(idRef.current, setIsOwner), []);

  useEffect(() => {
    if (!isOwner) return;
    if (!playing && isPending()) return;
    setPlaying(playing);
  }, [isOwner, playing, setPlaying]);

  useEffect(() => {
    if (!isOwner) return;
    if (isPending()) return;
    setProgress(position, duration);
  }, [isOwner, position, duration, setProgress]);

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
        if (q.length === 0) return;

        let activeId: string | undefined;
        let activeIndex: number | undefined;

        if (typeof TP.getActiveTrack === "function") {
          try {
            const t = await TP.getActiveTrack();
            if (t && t.id != null) {
              activeId = String(t.id);
            }
          } catch {}
        }

        if (typeof TP.getActiveTrackIndex === "function") {
          try {
            const r = await TP.getActiveTrackIndex();
            if (typeof r === "number") activeIndex = r;
          } catch {}
        }

        if (!alive) return;

        let reportedIndex = -1;
        if (activeIndex != null && activeIndex >= 0 && activeIndex < q.length) {
          reportedIndex = activeIndex;
        } else if (activeId) {
          reportedIndex = q.findIndex((s) => String(s.id) === activeId);
        }
        if (reportedIndex < 0) return;

        const reportedSongId = String(q[reportedIndex]?.id);

        if (shouldIgnoreDetected(reportedSongId)) return;

        const latest = usePlayerStore.getState();
        if (reportedIndex !== latest.currentIndex) {
          latest.setCurrentIndex(reportedIndex);
        }
      } catch {
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

  useEffect(() => {
    if (!isOwner) return;
    const aid = activeTrack?.id;
    if (!aid) return;

    if (shouldIgnoreDetected(String(aid))) return;

    const idx = queue.findIndex((s) => String(s.id) === String(aid));
    if (idx >= 0 && idx !== currentIndex) {
      setCurrentIndex(idx);
    }
  }, [
    isOwner,
    activeTrack?.id,
    queue,
    currentIndex,
    setCurrentIndex,
  ]);

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
        // 🔥 FIX: Ensure player is setup before doing anything
        await ensurePlayerSetup();

        if (typeof TP.add !== "function") {
          throw new Error("RNTP add() is unavailable.");
        }

        setPending(songs[startIndex].id);
        setQueue(songs, startIndex);
        setProgress(0, songs[startIndex].duration || 0);
        setPlaying(true);
        await nextFrame();

        if (token !== playToken) return;
        
        await TP.reset();
        await TP.add(toMediaItems(songs));
        await TP.skip(startIndex);
        nativeQueueSig = queueSig(songs);

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
      await ensurePlayerSetup();
      const state = await TP.getState();
      const actualPlaying = state === State.Playing;

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
        await ensurePlayerSetup();
        
        setPending(songs[targetIndex].id);
        setCurrentIndex(targetIndex);
        setProgress(0, songs[targetIndex].duration || 0);
        setPlaying(true);
        await nextFrame();

        if (token !== playToken) return;
        const sig = queueSig(songs);
        let skipped = false;

        if (USE_SKIP && sig === nativeQueueSig) {
          if (typeof TP.skip === "function") {
            try {
              await TP.skip(targetIndex);
              skipped = true;
            } catch {}
          }
        }

        if (!skipped) {
          if (typeof TP.add !== "function") {
            throw new Error("RNTP add() is unavailable.");
          }
          await TP.reset();
          await TP.add(toMediaItems(songs));
          await TP.skip(targetIndex);
          nativeQueueSig = sig;
        }

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
      await ensurePlayerSetup();
      const pos = await readPosition(TP);
      if (pos > 3) {
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
      await ensurePlayerSetup();
      await getTrackPlayer().seekTo(value);
    } catch (error) {
      console.error("[seek] Failed:", error);
    }
  }, []);

  const seekBy = useCallback(async (delta: number) => {
    if (!isTrackPlayerAvailable()) return;
    const TP = getTrackPlayer();

    try {
      await ensurePlayerSetup();
      const pos = await readPosition(TP);
      const dur = await readDuration(TP);
      await TP.seekTo(Math.max(0, Math.min(dur, pos + delta)));
    } catch (error) {
      console.error("[seekBy] Failed:", error);
    }
  }, []);

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

    if (!isTrackPlayerAvailable()) return;
    const TP = getTrackPlayer();
    try {
      await ensurePlayerSetup();
      if (typeof TP.add !== "function" || songs.length === 0) return;

      const wasPlaying = usePlayerStore.getState().isPlaying;
      const pos = await readPosition(TP);

      await TP.reset();
      await TP.add(toMediaItems(songs));
      await TP.skip(nextIndex);
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
      await ensurePlayerSetup();
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