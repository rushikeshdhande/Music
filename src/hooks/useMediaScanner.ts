import { useCallback } from "react";
import { useMediaStore } from "../store/mediaStore";
import { scanAudio } from "../services/mediaScanner/audioScanner";
import { mediaDatabase } from "../services/mediaScanner/mediaDatabase";

export function useMediaScanner() {
  const setSongs = useMediaStore((s) => s.setSongs);

  const scanAll = useCallback(async () => {
    console.log("[DEBUG] scanAll() CALLED");

    const songs = await scanAudio();

    console.log("[DEBUG] Songs returned:", songs.length);

    const favorites = useMediaStore.getState().favoritesSong;
    const withFav = songs.map((s) => ({
      ...s,
      isFavorite: !!favorites[s.id],
    }));

    setSongs(withFav);
    await mediaDatabase.saveSongIds(songs.map((s) => s.id));

    return songs.length;
  }, [setSongs]);

  const scanEverything = useCallback(async () => {
    await scanAll();
  }, [scanAll]);

  return { scanAll, scanEverything };
}