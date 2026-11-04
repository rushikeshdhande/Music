// src/store/artistStore.ts
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@favourite_artists_v1";

type ArtistState = {
  favourites: Record<string, boolean>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleFavourite: (name: string) => void;
  isFavourite: (name: string) => boolean;
};

export const useArtistStore = create<ArtistState>((set, get) => ({
  favourites: {},
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          set({ favourites: parsed, hydrated: true });
          return;
        }
      }
    } catch {}
    set({ hydrated: true });
  },

  toggleFavourite: (name: string) => {
    const key = (name ?? "").trim();
    if (!key) return;
    const next = { ...get().favourites };
    if (next[key]) delete next[key];
    else next[key] = true;
    set({ favourites: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  isFavourite: (name: string) => !!get().favourites[(name ?? "").trim()],
}));