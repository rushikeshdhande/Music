// src/store/extraSettingsStore.ts
// Persisted store for the settings that previously lived only in local state.
// Requires: zustand, @react-native-async-storage/async-storage
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CellularKey =
  | "high_efficiency"
  | "high_quality"
  | "lossless"
  | "hi_res_lossless";

export type CrossfadeMode = "automatic" | "manual" | "off";

// ✅ NEW: Widget types
export type WidgetStyle = "light" | "dark" | "system";
export type WidgetSize = "small" | "medium" | "large";

type Data = {
  addPlaylistSongs: boolean;
  addFavouriteSongs: boolean;
  losslessAudio: boolean;
  cellularStreaming: CellularKey;
  crossfadeMode: CrossfadeMode;
  crossfadeSeconds: number;
  soundCheck: boolean;

  // ✅ NEW: Home Screen Widgets
  widgetsEnabled: boolean;
  widgetStyle: WidgetStyle;
  widgetSize: WidgetSize;
  widgetShowNowPlaying: boolean;
};

type Actions = {
  setAddPlaylistSongs: (v: boolean) => void;
  setAddFavouriteSongs: (v: boolean) => void;
  setLosslessAudio: (v: boolean) => void;
  setCellularStreaming: (v: CellularKey) => void;
  setCrossfadeMode: (v: CrossfadeMode) => void;
  setCrossfadeSeconds: (v: number) => void;
  setSoundCheck: (v: boolean) => void;

  // ✅ NEW: Home Screen Widgets
  setWidgetsEnabled: (v: boolean) => void;
  setWidgetStyle: (v: WidgetStyle) => void;
  setWidgetSize: (v: WidgetSize) => void;
  setWidgetShowNowPlaying: (v: boolean) => void;

  reset: () => void;
};

export const EXTRA_DEFAULTS: Data = {
  addPlaylistSongs: true,
  addFavouriteSongs: true,
  losslessAudio: false,
  cellularStreaming: "high_quality",
  crossfadeMode: "automatic",
  crossfadeSeconds: 6,
  soundCheck: false,

  // ✅ NEW: Home Screen Widgets
  widgetsEnabled: true,
  widgetStyle: "system",
  widgetSize: "medium",
  widgetShowNowPlaying: true,
};

export const useExtraSettings = create<Data & Actions>()(
  persist(
    (set) => ({
      ...EXTRA_DEFAULTS,
      setAddPlaylistSongs: (addPlaylistSongs) => set({ addPlaylistSongs }),
      setAddFavouriteSongs: (addFavouriteSongs) => set({ addFavouriteSongs }),
      setLosslessAudio: (losslessAudio) => set({ losslessAudio }),
      setCellularStreaming: (cellularStreaming) => set({ cellularStreaming }),
      setCrossfadeMode: (crossfadeMode) => set({ crossfadeMode }),
      setCrossfadeSeconds: (crossfadeSeconds) => set({ crossfadeSeconds }),
      setSoundCheck: (soundCheck) => set({ soundCheck }),

      // ✅ NEW: Home Screen Widgets
      setWidgetsEnabled: (widgetsEnabled) => set({ widgetsEnabled }),
      setWidgetStyle: (widgetStyle) => set({ widgetStyle }),
      setWidgetSize: (widgetSize) => set({ widgetSize }),
      setWidgetShowNowPlaying: (widgetShowNowPlaying) =>
        set({ widgetShowNowPlaying }),

      reset: () => set({ ...EXTRA_DEFAULTS }),
    }),
    {
      name: "apple-extra-settings",
      storage: createJSONStorage(() => AsyncStorage),
      // ✅ Optional: version + migrate so existing users don't lose data
      version: 1,
      migrate: (persisted: any, version: number) => {
        if (!persisted || typeof persisted !== "object") return persisted;

        // v0 -> v1: backfill widget defaults for users on older builds
        if (version < 1) {
          return {
            ...EXTRA_DEFAULTS,
            ...persisted,
            widgetsEnabled:
              persisted.widgetsEnabled ?? EXTRA_DEFAULTS.widgetsEnabled,
            widgetStyle: persisted.widgetStyle ?? EXTRA_DEFAULTS.widgetStyle,
            widgetSize: persisted.widgetSize ?? EXTRA_DEFAULTS.widgetSize,
            widgetShowNowPlaying:
              persisted.widgetShowNowPlaying ??
              EXTRA_DEFAULTS.widgetShowNowPlaying,
          };
        }

        return persisted;
      },
    },
  ),
);