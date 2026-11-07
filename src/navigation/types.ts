// src/navigation/types.ts

export type RootStackParamList = {
  Tabs: undefined;
  Queue: undefined;
  Settings: undefined;
  FavouriteSongs: undefined;
  Playlists: undefined;
  Account: undefined;

  // ✅ NEW — Artists
  Artists: undefined;
  ArtistDetails: { artistName: string };
};

// ✅ TabParamList — all 5 tabs wired
export type TabParamList = {
  Home: undefined;
  New: undefined;
  Radio: undefined;
  Library: undefined;
  Search: undefined;
};

// ── Sub-stack param lists ────────────────────────────────────────────────

export type HomeStackParamList = {
  HomeMain: undefined;
  Songs: undefined;
  Albums: undefined;
  AlbumDetails: { album: any };
  MusicVideos: undefined;

  // ✅ NEW
  Artists: undefined;
  ArtistDetails: { artistName: string };
};

export type NewStackParamList = {
  NewMain: undefined;
};

export type RadioStackParamList = {
  RadioMain: undefined;
};

export type SearchStackParamList = {
  SearchMain: undefined;
};

export type LibraryStackParamList = {
  LibraryMain: undefined;
  Songs: undefined;
  Albums: undefined;
  AlbumDetails: { album: any };
  Playlists: undefined;
  PlaylistDetails: { playlistId: string } | undefined;
  FavouriteSongs: undefined;
  MusicVideos: undefined;

  // ✅ NEW
  Artists: undefined;
  ArtistDetails: { artistName: string };
};