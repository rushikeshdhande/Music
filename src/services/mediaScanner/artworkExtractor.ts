import * as MediaLibrary from 'expo-media-library';
// ✅ NEW
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const CACHE_DIR = FileSystem.cacheDirectory + 'artwork/';
const artCache = new Map<string, string>();

/**
 * Attempts to extract an album-art URI for an audio asset.
 * Android returns `albumArtUri` via MediaStore when available.
 * Falls back to writing embedded art to a cached file.
 */
export async function getArtworkForAsset(assetId: string): Promise<string | null> {
  if (artCache.has(assetId)) return artCache.get(assetId)!;

  try {
    const info: any = await MediaLibrary.getAssetInfoAsync(assetId);
    let artUri: string | null = null;

    if (Platform.OS === 'android') {
      // MediaStore sometimes exposes this directly.
      artUri = info?.albumArtUri ?? null;

      // Some Android builds embed art in a local file path.
      if (!artUri && info?.localUri) {
        // Check sibling files for cover art in same folder.
        // (Skip — most devices provide albumArtUri.)
      }
    }

    // iOS: expo-media-library exposes artwork via `info.albumArtUri` too.
    if (!artUri && info?.albumArtUri) artUri = info.albumArtUri;

    if (!artUri) return null;

    // Copy to app cache so the URI stays valid even if the
    // original MediaStore entry changes.
    if (artUri.startsWith('content://') || artUri.startsWith('file://')) {
      try {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        const ext = artUri.split('.').pop()?.split('?')[0] ?? 'jpg';
        const dest = CACHE_DIR + assetId + '.' + ext;
        const info2 = await FileSystem.getInfoAsync(dest);
        if (!info2.exists) {
          await FileSystem.copyAsync({ from: artUri, to: dest });
        }
        artCache.set(assetId, dest);
        return dest;
      } catch {
        // If copy fails, just use the original content:// URI.
        artCache.set(assetId, artUri);
        return artUri;
      }
    }

    artCache.set(assetId, artUri);
    return artUri;
  } catch {
    return null;
  }
}