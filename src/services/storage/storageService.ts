import AsyncStorage from '@react-native-async-storage/async-storage';

const NS = '@lmvp:';

export const storage = {
  async get<T>(key: string, def: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(NS + key);
      if (raw == null) return def;
      return JSON.parse(raw) as T;
    } catch {
      return def;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(NS + key, JSON.stringify(value));
    } catch {}
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(NS + key);
    } catch {}
  },
};

export const KEYS = {
  THEME: 'theme',
  AUTO_RESCAN: 'autoRescan',
  FAVORITES_SONG: 'favSongs',
  RECENT_SONGS: 'recentSongs',
  LAST_PLAYED: 'lastPlayed',
  POSITION: 'lastPosition',
  QUEUE: 'queue',
  NOTIFICATIONS: 'notifEnabled',
  DYNAMIC_BG: 'dynamicBg',
  DEFAULT_SPEED: 'defaultSpeed',
  SHUFFLE: 'shuffle',
  REPEAT: 'repeat',
  CONTINUE: 'continuePlayback',
  KEEP_AWAKE: 'keepAwake',
  SONG_IDS: 'songIds',
};