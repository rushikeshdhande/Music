import { useEffect } from 'react';
import TrackPlayer from '@rntp/player';
import { usePlayerStore } from '../store/playerStore';
import { toArtworkUri } from '../services/audio/mediaItem';

export function useMediaSessionSync() {
  useEffect(() => {
    let lastKey = '';

    const push = () => {
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

      try {
        const id = String(currentTrack.id);
        const idx = TrackPlayer.getQueue().findIndex((m: any) => m.mediaId === id);
        if (idx < 0) return; // native queue not ready yet; the interval retries

        TrackPlayer.updateMetadata(idx, {
          title: currentTrack.title || 'Unknown Title',
          artist: currentTrack.artist || 'Unknown Artist',
          albumTitle: currentTrack.album || 'Unknown Album',
          artworkUrl: art,
        });
        lastKey = key;
      } catch {}
    };

    push();
    const unsub = usePlayerStore.subscribe(push);
    const timer = setInterval(push, 1500); // artwork may land after the song starts
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);
}