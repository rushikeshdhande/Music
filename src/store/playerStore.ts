import { create } from 'zustand';
import { Song, RepeatMode } from '../types';

interface PlayerState {
  queue: Song[];
  currentIndex: number;
  currentTrack: Song | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;

  setQueue: (q: Song[], index?: number) => void;
  setCurrentIndex: (i: number) => void;
  setCurrentTrack: (track: Song | null) => void;
  setPlaying: (v: boolean) => void;
  setProgress: (pos: number, dur: number) => void;
  setShuffle: (v: boolean) => void;
  setRepeat: (r: RepeatMode) => void;
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  moveInQueue: (from: number, to: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off',

  setQueue: (queue, index = 0) => {
    const safeIndex =
      queue.length === 0
        ? -1
        : Math.max(0, Math.min(index, queue.length - 1));
    set({
      queue,
      currentIndex: safeIndex,
      currentTrack: queue[safeIndex] ?? null,
    });
  },

  setCurrentIndex: (i) => {
    const { queue, currentIndex } = get();
    if (i < 0 || i >= queue.length) return;
    // No-op when nothing changes: avoids extra renders / duplicate detects.
    if (i === currentIndex) return;
    set({
      currentIndex: i,
      currentTrack: queue[i] ?? null,
    });
  },

  setCurrentTrack: (track) => set({ currentTrack: track }),

  setPlaying: (isPlaying) => {
    if (get().isPlaying === isPlaying) return;
    set({ isPlaying });
  },

  setProgress: (position, duration) => {
    const s = get();
    if (s.position === position && s.duration === duration) return;
    set({ position, duration });
  },

  setShuffle: (shuffle) => set({ shuffle }),
  setRepeat: (repeat) => set({ repeat }),

  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),

  playNext: (song) =>
    set((s) => {
      const q = [...s.queue];
      const insertAt = Math.max(0, s.currentIndex + 1);
      q.splice(insertAt, 0, song);
      return { queue: q };
    }),

  removeFromQueue: (index) =>
    set((s) => {
      const q = s.queue.filter((_, i) => i !== index);
      let ci = s.currentIndex;
      if (index < ci) ci--;
      if (index === ci && q.length === 0) ci = -1;
      if (ci >= q.length) ci = q.length - 1;
      return {
        queue: q,
        currentIndex: ci,
        currentTrack: q[ci] ?? null,
      };
    }),

  clearQueue: () =>
    set({ queue: [], currentIndex: -1, currentTrack: null }),

  moveInQueue: (from, to) =>
    set((s) => {
      const q = [...s.queue];
      if (from < 0 || to < 0 || from >= q.length || to >= q.length)
        return {};
      const [item] = q.splice(from, 1);
      q.splice(to, 0, item);
      let ci = s.currentIndex;
      if (ci === from) ci = to;
      else if (from < ci && to >= ci) ci--;
      else if (from > ci && to <= ci) ci++;
      return {
        queue: q,
        currentIndex: ci,
        currentTrack: q[ci] ?? null,
      };
    }),
}));