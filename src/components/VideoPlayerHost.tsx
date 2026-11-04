// src/components/VideoPlayerHost.tsx
//
// HEADLESS video engine. It no longer draws any UI (the mini player, the
// expanded sheet, the options sheet and the fullscreen player now live in
// MiniPlayer.tsx). This component only:
//   - owns the expo-video player
//   - loads / plays the current video from useVideoStore
//   - keeps music and video from playing at the same time
//   - publishes live state + controls to useVideoBridge for MiniPlayer
//
// Keep it mounted exactly where it was mounted before.
import { useCallback, useEffect, useRef, useState } from "react";
import { useVideoPlayer } from "expo-video";
import { useEvent, useEventListener } from "expo";

import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { usePlayerStore } from "../store/playerStore";
import { useVideoStore } from "../store/videoStore";
import { useVideoBridge } from "../store/videoPlayerBridge";
import { showToast } from "../utils/toast";

// Position / duration go straight to the bridge so this component does not
// re-render on every time update.
const pushPosition = (n: number) => {
  if (useVideoBridge.getState().position !== n) {
    useVideoBridge.setState({ position: n });
  }
};
const pushDuration = (n: number) => {
  if (useVideoBridge.getState().duration !== n) {
    useVideoBridge.setState({ duration: n });
  }
};

export default function VideoPlayerHost() {
  const current = useVideoStore((s) => s.current);
  const playToken = useVideoStore((s) => s.playToken);
  const nextVideo = useVideoStore((s) => s.next);
  const closeVideo = useVideoStore((s) => s.close);
  const loadFavs = useVideoStore((s) => s.loadFavs);

  const { playPause: musicPlayPause } = useAudioPlayer() as any;
  const musicPlaying = usePlayerStore((s) => s.isPlaying);
  const muted = useVideoBridge((s) => s.muted);

  const musicToggleRef = useRef(musicPlayPause);
  musicToggleRef.current = musicPlayPause;

  const player = useVideoPlayer(null as any, (p: any) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
    p.staysActiveInBackground = true;
    try {
      p.bufferOptions = { minBufferForPlayback: 0.5 };
    } catch {}
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  }) as { isPlaying: boolean };

  const [starting, setStarting] = useState(false);
  const uiPlaying = isPlaying || starting;

  useEffect(() => {
    if (isPlaying) setStarting(false);
  }, [isPlaying]);

  useEffect(() => {
    loadFavs();
  }, [loadFavs]);

  // â”€â”€ publish state to the bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    useVideoBridge.setState({ player });
    return () => useVideoBridge.setState({ player: null });
  }, [player]);

  useEffect(() => {
    useVideoBridge.setState({ isPlaying: uiPlaying });
  }, [uiPlaying]);

  // â”€â”€ player events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEventListener(player, "timeUpdate", (e: any) => {
    pushPosition(e?.currentTime ?? 0);
    const d = player.duration;
    if (d > 0) pushDuration(d);
  });

  useEventListener(player, "statusChange", (e: any) => {
    if (e?.status === "readyToPlay") {
      pushDuration(player.duration || 0);
    } else if (e?.status === "error") {
      showToast("Video failed to load");
    }
  });

  useEventListener(player, "playToEnd", () => {
    const { queue: q } = useVideoStore.getState();
    if (q.length > 1) {
      nextVideo();
    } else {
      try {
        player.currentTime = 0;
        player.pause();
      } catch {}
      pushPosition(0);
    }
  });

  // â”€â”€ music / video never play together â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!current) return;
    if (usePlayerStore.getState().isPlaying) {
      void musicToggleRef.current?.();
    }
  }, [current?.url, playToken]);


  useEffect(() => {
    if (musicPlaying && useVideoStore.getState().current) {
      closeVideo();
    }
  }, [musicPlaying]);

  // â”€â”€ load the current video â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!current) {
      try {
        player.pause();
      } catch {}
      pushPosition(0);
      pushDuration(0);
      setStarting(false);
      return;
    }
    pushPosition(0);
    pushDuration(0);
    setStarting(true);
    const startingTimer = setTimeout(() => setStarting(false), 8000);
    let cancelled = false;

    try {
      const p: any = player;
      const replace = p.replaceAsync ?? p.replace;

      const loading = replace.call(p, {
        uri: current.url,
        metadata: {
          title: current.title,
          artist: current.artist,
          artwork: current.thumbnail,
        },
      });

      Promise.resolve(loading)
        .then(() => {
          if (cancelled) return;
          // Keep playback start in one place, after the source is ready.
          // Do not toggle music here: the current-video effect handles it once.
          try {
            p.muted = useVideoBridge.getState().muted;
            p.play();
          } catch (error) {
            console.warn("[VideoPlayerHost] play failed:", error);
          }
        })
        .catch((e: any) => {
          if (cancelled) return;
          console.log("[VideoPlayerHost] load error:", e);
          setStarting(false);
          showToast("Video failed to load");
        });
    } catch (e) {
      console.log("[VideoPlayerHost] load error:", e);
      setStarting(false);
      showToast("Video failed to load");
    }

    return () => {
      cancelled = true;
      clearTimeout(startingTimer);
    };
  }, [current?.url, playToken]);

  useEffect(() => {
    try {
      player.muted = muted;
    } catch {}
  }, [muted, player, current?.url]);

  // â”€â”€ controls (registered in the bridge) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const seekTo = useCallback(
    (sec: number) => {
      const d = player.duration > 0 ? player.duration : Infinity;
      const t = Math.max(0, Math.min(d, sec));
      try {
        player.currentTime = t;
      } catch {}
      pushPosition(t);
    },
    [player],
  );

  const skip = useCallback(
    (delta: number) => seekTo((player.currentTime ?? 0) + delta),
    [player, seekTo],
  );

  const togglePlay = useCallback(() => {
    try {
      if (player.playing || starting) {
        player.pause();
        setStarting(false);
      } else {
        if (
          player.duration > 0 &&
          player.currentTime >= player.duration - 0.3
        ) {
          player.currentTime = 0;
        }
        player.play();
      }
    } catch {}
  }, [player, starting]);

  const toggleMute = useCallback(() => {
    const nextMuted = !useVideoBridge.getState().muted;

    try {
      player.muted = nextMuted;
      useVideoBridge.setState({ muted: nextMuted });
    } catch (error) {
      console.warn("[VideoPlayerHost] toggleMute failed:", error);
    }
  }, [player]);

  useEffect(() => {
    useVideoBridge.setState({
      togglePlay,
      seekTo,
      skip,
      toggleMute,
    });
  }, [togglePlay, seekTo, skip, toggleMute]);

  // No UI here â€“ MiniPlayer draws everything.
  return null;
}
