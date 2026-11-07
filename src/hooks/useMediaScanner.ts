// src/hooks/useMediaScanner.ts
import { useCallback } from "react";
import { useMediaStore } from "../store/mediaStore";
import { scanAudio } from "../services/mediaScanner/audioScanner";
import { mediaDatabase } from "../services/mediaScanner/mediaDatabase";

// ── Module-level guard: at most ONE native scan at a time ──────────────────
let inflight: Promise<number> | null = null;

async function runScan(): Promise<number> {
  if (inflight) return inflight;

  inflight = (async () => {
    console.log("[DEBUG] scanAll() CALLED");
    const songs = await scanAudio();
    console.log("[DEBUG] Songs returned:", songs.length);

    const favorites = useMediaStore.getState().favoritesSong;
    const withFav = songs.map((s) => ({
      ...s,
      isFavorite: !!favorites[s.id],
    }));

    useMediaStore.getState().setSongs(withFav);
    await mediaDatabase.saveSongIds(songs.map((s) => s.id));
    return songs.length;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useMediaScanner() {
  const scanAll = useCallback(() => runScan(), []);
  const scanEverything = useCallback(() => runScan(), []);
  return { scanAll, scanEverything };
}