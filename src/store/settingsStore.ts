import { create } from 'zustand';
import { storage, KEYS } from '../services/storage/storageService';
import { ThemeMode, RepeatMode } from '../types';

interface SettingsState {
  hydrated: boolean;
  theme: ThemeMode;
  autoRescan: boolean;
  dynamicBg: boolean;
  notifications: boolean;
  defaultSpeed: number;
  shuffle: boolean;
  repeat: RepeatMode;
  continuePlayback: boolean;
  keepAwake: boolean;

  hydrate: () => Promise<void>;
  setTheme: (t: ThemeMode) => void;
  setAutoRescan: (v: boolean) => void;
  setDynamicBg: (v: boolean) => void;
  setNotifications: (v: boolean) => void;
  setDefaultSpeed: (v: number) => void;
  setShuffle: (v: boolean) => void;
  setRepeat: (v: RepeatMode) => void;
  setContinuePlayback: (v: boolean) => void;
  setKeepAwake: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hydrated: false,
  theme: 'dark',
  autoRescan: true,
  dynamicBg: true,
  notifications: true,
  defaultSpeed: 1,
  shuffle: false,
  repeat: 'off',
  continuePlayback: true,
  keepAwake: false,

  async hydrate() {
    const [
      theme, autoRescan, dynamicBg, notifications, defaultSpeed,
      shuffle, repeat, continuePlayback, keepAwake,
    ] = await Promise.all([
      storage.get<ThemeMode>(KEYS.THEME, 'dark'),
      storage.get<boolean>(KEYS.AUTO_RESCAN, true),
      storage.get<boolean>(KEYS.DYNAMIC_BG, true),
      storage.get<boolean>(KEYS.NOTIFICATIONS, true),
      storage.get<number>(KEYS.DEFAULT_SPEED, 1),
      storage.get<boolean>(KEYS.SHUFFLE, false),
      storage.get<RepeatMode>(KEYS.REPEAT, 'off'),
      storage.get<boolean>(KEYS.CONTINUE, true),
      storage.get<boolean>(KEYS.KEEP_AWAKE, false),
    ]);
    set({
      theme, autoRescan, dynamicBg, notifications, defaultSpeed,
      shuffle, repeat, continuePlayback, keepAwake,
      hydrated: true,
    });
  },

  setTheme: (t) => { set({ theme: t }); storage.set(KEYS.THEME, t); },
  setAutoRescan: (v) => { set({ autoRescan: v }); storage.set(KEYS.AUTO_RESCAN, v); },
  setDynamicBg: (v) => { set({ dynamicBg: v }); storage.set(KEYS.DYNAMIC_BG, v); },
  setNotifications: (v) => { set({ notifications: v }); storage.set(KEYS.NOTIFICATIONS, v); },
  setDefaultSpeed: (v) => { set({ defaultSpeed: v }); storage.set(KEYS.DEFAULT_SPEED, v); },
  setShuffle: (v) => { set({ shuffle: v }); storage.set(KEYS.SHUFFLE, v); },
  setRepeat: (v) => { set({ repeat: v }); storage.set(KEYS.REPEAT, v); },
  setContinuePlayback: (v) => { set({ continuePlayback: v }); storage.set(KEYS.CONTINUE, v); },
  setKeepAwake: (v) => { set({ keepAwake: v }); storage.set(KEYS.KEEP_AWAKE, v); },
}));