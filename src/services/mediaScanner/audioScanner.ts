import * as MediaLibrary from 'expo-media-library/legacy';
import { Song } from '../../types';

// ---------------------------------------------------------------------------
// Duration normalization — MediaStore sometimes returns ms instead of seconds
// ---------------------------------------------------------------------------
const normalizeDuration = (d: unknown): number | undefined => {
  if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) {
    return undefined;
  }

  // Anything above 10 hours in seconds is likely milliseconds
  return d > 36000 ? d / 1000 : d;
};

// ---------------------------------------------------------------------------
// Main audio scanner
// ---------------------------------------------------------------------------
export async function scanAudio(): Promise<Song[]> {
  try {
    // 1. Check audio permission
    let permission = await MediaLibrary.getPermissionsAsync(false, ['audio']);

    if (!permission.granted && permission.canAskAgain) {
      permission = await MediaLibrary.requestPermissionsAsync(false, [
        'audio',
      ]);
    }

    if (!permission.granted) {
      return [];
    }

    // 2. Paginate through audio assets
    const songs: Song[] = [];
    let after: string | undefined;

    while (true) {
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: ['audio'],
        first: 500,
        after,
        sortBy: [['creationTime', false]],
      });

      for (const asset of page.assets as any[]) {
        // 2a. Get duration from the asset
        let duration = normalizeDuration(asset.duration);

        // 2b. Fallback to asset info
        if (!duration) {
          try {
            const info: any = await MediaLibrary.getAssetInfoAsync(asset.id);
            duration = normalizeDuration(info?.duration);
          } catch {
            // Continue gracefully if duration cannot be fetched
          }
        }

        songs.push({
          id: asset.id,
          uri: asset.uri,
          title: (asset.filename || 'Unknown Song').replace(/\.[^.]+$/, ''),
          artist: asset.artist || 'Unknown Artist',
          album: asset.album || 'Unknown Album',
          albumArt: null,
          duration: duration ?? 0,
          fileName: asset.filename || '',
          fileSize: asset.fileSize ?? 0,
          dateAdded: asset.creationTime ?? Date.now(),
          dateModified:
            asset.modificationTime ?? asset.creationTime ?? Date.now(),
          isFavorite: false,
        });
      }

      if (!page.hasNextPage || !page.endCursor) {
        break;
      }

      after = page.endCursor;
    }

    return songs;
  } catch (error) {
    console.error('[scanAudio] Failed to scan audio:', error);
    return [];
  }
}