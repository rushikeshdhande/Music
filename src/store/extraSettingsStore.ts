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

type Data = {
  addPlaylistSongs: boolean;
  addFavouriteSongs: boolean;
  losslessAudio: boolean;
  cellularStreaming: CellularKey;
  crossfadeMode: CrossfadeMode;
  crossfadeSeconds: number;
  soundCheck: boolean;
};

type Actions = {
  setAddPlaylistSongs: (v: boolean) => void;
  setAddFavouriteSongs: (v: boolean) => void;
  setLosslessAudio: (v: boolean) => void;
  setCellularStreaming: (v: CellularKey) => void;
  setCrossfadeMode: (v: CrossfadeMode) => void;
  setCrossfadeSeconds: (v: number) => void;
  setSoundCheck: (v: boolean) => void;
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
      reset: () => set({ ...EXTRA_DEFAULTS }),
    }),
    {
      name: "apple-extra-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);