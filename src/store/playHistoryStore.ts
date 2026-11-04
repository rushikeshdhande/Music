import { create } from "zustand";
import * as FileSystem from "expo-file-system/legacy";
import { usePlayerStore } from "./playerStore";

const FILE = (FileSystem.documentDirectory ?? "") + "play_history.json";
const MAX_RECENT = 50;
const COUNT_AFTER_MS = 5000; // a song counts as "played" after 5 seconds

// k: "s" = song, "v" = music video
export type RecentItem = { k: "s" | "v"; id: string; t: number };

type HistoryState = {
  counts: Record<string, number>; // songId → play count
  recentItems: RecentItem[]; // songs + videos, most recent first (unique)
  hydrated: boolean;
  recordPlay: (id: string) => void; // song
  recordVideoPlay: (id: string) => void; // music video
};

const pushRecent = (list: RecentItem[], k: "s" | "v", id: string) =>
  [{ k, id, t: Date.now() }, ...list.filter((x) => !(x.k === k && x.id === id))].slice(
    0,
    MAX_RECENT,
  );

export const usePlayHistoryStore = create<HistoryState>((set) => ({
  counts: {},
  recentItems: [],
  hydrated: false,
  recordPlay: (id) =>
    set((s) => ({
      counts: { ...s.counts, [id]: (s.counts[id] ?? 0) + 1 },
      recentItems: pushRecent(s.recentItems, "s", id),
    })),
  recordVideoPlay: (id) =>
    set((s) => ({ recentItems: pushRecent(s.recentItems, "v", id) })),
}));

// ── Load saved history once ────────────────────────────────────────────────
(async () => {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (info.exists) {
      const saved = JSON.parse(await FileSystem.readAsStringAsync(FILE));

      // new format
      let savedItems: RecentItem[] = Array.isArray(saved.recentItems)
        ? saved.recentItems
        : [];
      // old format (songs only): convert, keeping the order
      if (savedItems.length === 0 && Array.isArray(saved.recent)) {
        savedItems = (saved.recent as string[]).map((id, i) => ({
          k: "s" as const,
          id,
          t: -i,
        }));
      }

      usePlayHistoryStore.setState((cur) => {
        const counts: Record<string, number> = { ...(saved.counts ?? {}) };
        Object.entries(cur.counts).forEach(([id, n]) => {
          counts[id] = (counts[id] ?? 0) + n;
        });
        // merge, in case something was played before loading finished
        const seen = new Set(cur.recentItems.map((x) => x.k + ":" + x.id));
        const recentItems = [
          ...cur.recentItems,
          ...savedItems.filter((x) => !seen.has(x.k + ":" + x.id)),
        ]
          .sort((a, b) => b.t - a.t)
          .slice(0, MAX_RECENT);
        return { counts, recentItems };
      });
    }
  } catch {
    // start fresh
  } finally {
    usePlayHistoryStore.setState({ hydrated: true });
  }
})();

// ── Save (debounced) ───────────────────────────────────────────────────────
let saveTimer: any = null;
usePlayHistoryStore.subscribe((s) => {
  if (!s.hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    FileSystem.writeAsStringAsync(
      FILE,
      JSON.stringify({ counts: s.counts, recentItems: s.recentItems }),
    ).catch(() => {});
  }, 500);
});

// ── Watch the player: count a song after 5s of real playback ───────────────
let trackId: string | null = null;
let counted = false;
let playTimer: any = null;

const clearPlayTimer = () => {
  if (playTimer) {
    clearTimeout(playTimer);
    playTimer = null;
  }
};

usePlayerStore.subscribe((s: any) => {
  const id: string | null = s.currentTrack?.id ?? null;
  const playing = !!s.isPlaying;

  if (id !== trackId) {
    clearPlayTimer();
    trackId = id;
    counted = false;
  }

  if (!id || id.startsWith("dummy-") || counted) return;

  if (!playing) {
    clearPlayTimer();
    return;
  }

  if (!playTimer) {
    playTimer = setTimeout(() => {
      playTimer = null;
      const st: any = usePlayerStore.getState();
      if (st.currentTrack?.id === id && st.isPlaying && !counted) {
        counted = true;
        usePlayHistoryStore.getState().recordPlay(id);
      }
    }, COUNT_AFTER_MS);
  }
});