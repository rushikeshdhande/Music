
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_USER = "@user_profile";
const LEGACY_NAME_KEY = "@account/username";
const LEGACY_NAME_SET_KEY = "@account/name_set";

type UserStore = {
  name: string;
  loaded: boolean;
  load: () => Promise<void>;
  setName: (name: string) => Promise<void>;
};

let loadPromise: Promise<void> | null = null;

export const useUserStore = create<UserStore>((set, get) => ({
  name: "",
  loaded: false,

  load: async () => {
    if (get().loaded) return;

    if (loadPromise) {
      await loadPromise;
      return;
    }

    loadPromise = (async () => {
      try {
        const [raw, legacyName] = await Promise.all([
          AsyncStorage.getItem(STORAGE_USER),
          AsyncStorage.getItem(LEGACY_NAME_KEY),
        ]);

        let savedName = "";

        // First priority: primary user profile
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed?.name === "string") {
              savedName = parsed.name.trim();
            }
          } catch (error) {
            console.warn("[UserStore] Invalid profile data:", error);
          }
        }

        // Second priority: legacy backup
        if (!savedName && legacyName) {
          savedName = legacyName.trim();
        }

        // Restore primary storage from backup if necessary
        if (savedName) {
          await AsyncStorage.setItem(
            STORAGE_USER,
            JSON.stringify({ name: savedName })
          );

          await AsyncStorage.setItem(
            LEGACY_NAME_KEY,
            savedName
          ).catch((error) => {
            console.warn("[UserStore] Backup write failed:", error);
          });

          await AsyncStorage.setItem(
            LEGACY_NAME_SET_KEY,
            "1"
          ).catch(() => {});
        }

        set({
          name: savedName,
          loaded: true,
        });

        console.log("[UserStore] Profile loaded:", savedName || "No name");
      } catch (error) {
        console.error("[UserStore] Profile load failed:", error);

        // Do not overwrite the current in-memory name on failure.
        set({ loaded: true });
      }
    })();

    try {
      await loadPromise;
    } finally {
      loadPromise = null;
    }
  },

  setName: async (name: string) => {
    const trimmed = name.trim();

    if (!trimmed) {
      throw new Error("Username cannot be empty");
    }

    // Primary storage must succeed before updating Zustand.
    await AsyncStorage.setItem(
      STORAGE_USER,
      JSON.stringify({ name: trimmed })
    );

    // Keep a second copy for recovery.
    await AsyncStorage.setItem(
      LEGACY_NAME_KEY,
      trimmed
    ).catch((error) => {
      console.warn("[UserStore] Backup write failed:", error);
    });

    await AsyncStorage.setItem(
      LEGACY_NAME_SET_KEY,
      "1"
    ).catch(() => {});

    set({
      name: trimmed,
      loaded: true,
    });

    console.log("[UserStore] Username saved:", trimmed);
  },
}));
