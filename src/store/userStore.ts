// src/store/userStore.ts
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_USER = "@user_profile";

type UserStore = {
  name: string;
  loaded: boolean;
  load: () => Promise<void>;
  setName: (name: string) => Promise<void>;
};

export const useUserStore = create<UserStore>((set) => ({
  name: "",
  loaded: false,
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_USER);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          name: typeof parsed?.name === "string" ? parsed.name : "",
          loaded: true,
        });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },
  setName: async (name: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_USER, JSON.stringify({ name }));
      set({ name });
    } catch {}
  },
}));