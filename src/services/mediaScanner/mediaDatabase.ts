import { storage, KEYS } from '../storage/storageService';

export const mediaDatabase = {
  async saveSongIds(ids: string[]) {
    await storage.set(KEYS.SONG_IDS, ids);
  },
  async loadSongIds(): Promise<string[]> {
    return storage.get<string[]>(KEYS.SONG_IDS, []);
  },
};