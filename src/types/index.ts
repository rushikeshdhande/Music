export interface Song {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string | null;
  duration: number;
  fileName: string;
  fileSize: number;
  dateAdded: number;
  dateModified: number;
  isFavorite: boolean;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type SortKey = 'recent' | 'title' | 'artist' | 'album' | 'duration';
export type RepeatMode = 'off' | 'queue' | 'track';