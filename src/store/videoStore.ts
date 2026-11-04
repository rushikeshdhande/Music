// src/store/videoStore.ts
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MusicVideo } from "../data/musicVideos";

const FAV_KEY = "@music_video_favs";

type VideoState = {
  queue: MusicVideo[];
  index: number;
  current: MusicVideo | null;
  /** bumps on every (re)start so the host reloads even for the same video */
  playToken: number;
  expanded: boolean;
  favourites: Record<string, boolean>;

  playQueue: (list: MusicVideo[], startIndex?: number) => void;
  next: () => void;
  prev: () => void;
  setExpanded: (v: boolean) => void;
  close: () => void;
  toggleFav: (id: string) => void;
  loadFavs: () => Promise<void>;
};

export const useVideoStore = create<VideoState>((set, get) => ({
  queue: [],
  index: 0,
  current: null,
  playToken: 0,
  expanded: false,
  favourites: {},

  playQueue: (list, startIndex = 0) => {
    if (!list.length) return;
    const i = Math.max(0, Math.min(list.length - 1, startIndex));
    set((s) => ({
      queue: list,
      index: i,
      current: list[i],
      playToken: s.playToken + 1,
    }));
  },

  next: () => {
    const { queue, index } = get();
    if (!queue.length) return;
    const i = (index + 1) % queue.length;
    set((s) => ({
      index: i,
      current: queue[i],
      playToken: s.playToken + 1,
    }));
  },

  prev: () => {
    const { queue, index } = get();
    if (!queue.length) return;
    const i = (index - 1 + queue.length) % queue.length;
    set((s) => ({
      index: i,
      current: queue[i],
      playToken: s.playToken + 1,
    }));
  },

  setExpanded: (v) => set({ expanded: v }),

  close: () => set({ current: null, queue: [], index: 0, expanded: false }),

  toggleFav: (id) => {
    const favourites = { ...get().favourites };
    if (favourites[id]) delete favourites[id];
    else favourites[id] = true;
    set({ favourites });
    AsyncStorage.setItem(FAV_KEY, JSON.stringify(favourites)).catch(() => {});
  },

  loadFavs: async () => {
    try {
      const raw = await AsyncStorage.getItem(FAV_KEY);
      if (raw) set({ favourites: JSON.parse(raw) });
    } catch {}
  },
}));