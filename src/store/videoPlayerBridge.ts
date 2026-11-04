// src/store/videoPlayerBridge.ts
import { create } from "zustand";

export type VideoBridgeState = {
  player: any | null;
  isPlaying: boolean;
  position: number;
  duration: number;

  muted: boolean;
  volume: number;
  _lastVolume: number;

  togglePlay: () => void;
  seekTo: (sec: number) => void;
  skip: (delta: number) => void;
  toggleMute: () => void;

  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  syncFromPlayer: (player: any) => void;

  _setPlayer: (p: any) => void;
  _setPlaying: (v: boolean) => void;
  _setPosition: (n: number) => void;
  _setDuration: (n: number) => void;
  _register: (c: {
    togglePlay?: () => void;
    seekTo?: (sec: number) => void;
    skip?: (d: number) => void;
    toggleMute?: () => void;
  }) => void;
};

export const useVideoBridge = create<VideoBridgeState>()((set, get) => ({
  player: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  muted: false,
  volume: 1,
  _lastVolume: 1,

  togglePlay: () => {},
  seekTo: () => {},
  skip: () => {},

  toggleMute: () => {
    const { player, muted, volume, _lastVolume } = get();
    const nextMuted = !muted;
    const nextVolume = nextMuted ? 0 : _lastVolume > 0 ? _lastVolume : 1;

    // 1. Flip UI state FIRST â€” icon swaps on the next render.
    set({
      muted: nextMuted,
      volume: nextVolume,
      _lastVolume: nextMuted ? volume || _lastVolume || 1 : nextVolume,
    });

    // 2. Then apply to the native video player (best-effort).
    if (player) {
      try {
        player.muted = nextMuted;
        if (typeof player.volume === "number") {
          player.volume = nextVolume;
        }
      } catch (err) {
        console.warn("[videoBridge] player mute failed:", err);
      }
    }
  },

  setVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    const { player } = get();

    if (player) {
      try {
        player.volume = clamped;
        player.muted = clamped === 0;
      } catch (err) {
        console.warn("[videoBridge] setVolume failed:", err);
      }
    }

    set((s) => ({
      volume: clamped,
      muted: clamped === 0,
      _lastVolume: clamped > 0 ? clamped : s._lastVolume,
    }));
  },

  setMuted: (m) => {
    const { player, volume, _lastVolume } = get();
    const nextVolume = m ? 0 : _lastVolume > 0 ? _lastVolume : 1;

    if (player) {
      try {
        player.muted = m;
        if (typeof player.volume === "number") player.volume = nextVolume;
      } catch (err) {
        console.warn("[videoBridge] setMuted failed:", err);
      }
    }

    set({
      muted: m,
      volume: nextVolume,
      _lastVolume: m ? volume || _lastVolume || 1 : nextVolume,
    });
  },

  syncFromPlayer: (player) => {
    if (!player) return;
    try {
      const muted = !!player.muted;
      const volume =
        typeof player.volume === "number" ? player.volume : muted ? 0 : 1;
      set((s) => ({
        muted,
        volume,
        _lastVolume: volume > 0 ? volume : s._lastVolume,
      }));
    } catch (err) {
      console.warn("[videoBridge] syncFromPlayer failed:", err);
    }
  },

  _setPlayer: (p) => {
    if (get().player === p) return;
    set({ player: p });
  },
  _setPlaying: (v) => {
    if (get().isPlaying === v) return;
    set({ isPlaying: v });
  },
  _setPosition: (n) => {
    if (get().position === n) return;
    set({ position: n });
  },
  _setDuration: (n) => {
    if (get().duration === n) return;
    set({ duration: n });
  },
  _register: (c) => {
    const cur = get();
    const next = {
      togglePlay: c.togglePlay ?? cur.togglePlay,
      seekTo: c.seekTo ?? cur.seekTo,
      skip: c.skip ?? cur.skip,
      toggleMute: c.toggleMute ?? cur.toggleMute,
    };
    if (
      next.togglePlay === cur.togglePlay &&
      next.seekTo === cur.seekTo &&
      next.skip === cur.skip &&
      next.toggleMute === cur.toggleMute
    )
      return;
    set(next);
  },
}));
