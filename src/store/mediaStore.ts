import { create } from 'zustand';
import { Song, SortKey } from '../types';
import { storage, KEYS } from '../services/storage/storageService';

interface MediaState {
  songs: Song[];
  sort: SortKey;
  favoritesSong: Record<string, boolean>;
  recentSongIds: string[];

  setSongs: (songs: Song[]) => void;
  setSort: (s: SortKey) => void;
  toggleSongFavorite: (id: string) => void;
  addRecentSong: (id: string) => void;
  hydrateFavorites: () => Promise<void>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  songs: [],
  sort: 'recent',
  favoritesSong: {},
  recentSongIds: [],

  setSongs: (songs) => set({ songs }),
  setSort: (sort) => set({ sort }),

  toggleSongFavorite: (id) => {
    const cur = get().favoritesSong;
    const next = { ...cur, [id]: !cur[id] };
    set({ favoritesSong: next });
    storage.set(KEYS.FAVORITES_SONG, next);
  },
  
  addRecentSong: (id) => {
    const cur = get().recentSongIds.filter((x) => x !== id);
    const next = [id, ...cur].slice(0, 100);
    set({ recentSongIds: next });
    storage.set(KEYS.RECENT_SONGS, next);
  },

  async hydrateFavorites() {
    const [fs, rec] = await Promise.all([
      storage.get<Record<string, boolean>>(KEYS.FAVORITES_SONG, {}),
      storage.get<string[]>(KEYS.RECENT_SONGS, []),
    ]);
    set({ favoritesSong: fs, recentSongIds: rec });
  },
}));