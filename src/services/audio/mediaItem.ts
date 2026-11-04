import { Song } from '../../types';

export const toArtworkUri = (p?: string | null): string | undefined => {
  if (!p) return undefined;
  return /^(https?:|file:|content:|data:)/.test(p) ? p : `file://${p}`;
};

export function songToMediaItem(song: Song) {
  const art = (song as any).artwork ?? song.albumArt;
  return {
    mediaId: String(song.id),                 // v5 field (not "id")
    url: song.uri,
    title: song.title || 'Unknown Title',
    artist: song.artist || 'Unknown Artist',
    albumTitle: song.album || 'Unknown Album', // v5 field (not "album")
    artworkUrl: toArtworkUri(art),
    duration: song.duration > 0 ? song.duration : undefined, // seconds
  };
}