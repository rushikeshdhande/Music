import { useEffect } from 'react';
import TrackPlayer from 'react-native-track-player';
import { usePlayerStore } from '../store/playerStore';
import { toArtworkUri } from '../services/audio/mediaItem';

export function useMediaSessionSync() {
  useEffect(() => {
    let lastKey = '';

    const push = async () => {
      try {
        const { currentTrack } = usePlayerStore.getState();
        if (!currentTrack) return;

        const art = toArtworkUri(
          (currentTrack as any).artwork ?? currentTrack.albumArt,
        );
        
        const key = [
          currentTrack.id,
          art ?? '',
          currentTrack.title,
          currentTrack.artist,
          currentTrack.album,
        ].join('|');
        
        if (key === lastKey) return;

        const id = String(currentTrack.id);
        
        // 🔥 FIX 1: getQueue is async in v4
        const queue = await TrackPlayer.getQueue();
        const idx = queue.findIndex((m: any) => m.mediaId === id || m.id === id);
        
        if (idx < 0) return; // Native queue not ready yet; the interval will retry

        // 🔥 FIX 2: Correct method and metadata keys for v4
        await TrackPlayer.updateMetadataForTrack(idx, {
          title: currentTrack.title || 'Unknown Title',
          artist: currentTrack.artist || 'Unknown Artist',
          album: currentTrack.album || 'Unknown Album', // v4 uses `album`, not `albumTitle`
          artwork: art || undefined, // v4 uses `artwork`, not `artworkUrl`
          duration: currentTrack.duration || 0, // Ensure lock screen seekbar works
        });
        
        lastKey = key;
      } catch (error) {
        // Silently ignore errors during sync (e.g., if player is resetting)
      }
    };

    // Initial push
    push();
    
    // Subscribe to Zustand store changes
    const unsub = usePlayerStore.subscribe(push);
    
    // Artwork may land after the song starts, so we retry periodically
    const timer = setInterval(push, 1500); 
    
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);
}