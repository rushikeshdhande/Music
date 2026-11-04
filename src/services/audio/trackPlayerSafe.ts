type TrackPlayerApi = Record<string, any>;

let cachedPlayer: TrackPlayerApi | null = null;

function loadPlayerModule(): any {
  // 🔥 FIX: Changed from "@rntp/player" to "react-native-track-player"
  const mod = require("react-native-track-player");
  return mod?.default ?? mod;
}

export function isTrackPlayerAvailable(): boolean {
  try {
    const player = loadPlayerModule();

    return (
      !!player &&
      typeof player.play === "function" &&
      typeof player.pause === "function"
    );
  } catch (error) {
    console.warn("[TrackPlayerSafe] Player unavailable:", error);
    return false;
  }
}

export function getTrackPlayer(): TrackPlayerApi {
  if (cachedPlayer) {
    return cachedPlayer;
  }

  const player = loadPlayerModule();

  if (!player) {
    throw new Error("react-native-track-player module is unavailable");
  }

  cachedPlayer = player as TrackPlayerApi;
  return cachedPlayer;
}

export function getTrackPlayerEnums(): {
  Event?: Record<string, any>;
  State?: Record<string, any>;
  RepeatMode?: Record<string, any>;
  Capability?: Record<string, any>;
} {
  try {
    // 🔥 FIX: Changed from "@rntp/player" to "react-native-track-player"
    const mod = require("react-native-track-player");

    return {
      Event: mod.Event,
      State: mod.State,
      RepeatMode: mod.RepeatMode,
      Capability: mod.Capability,
    };
  } catch (error) {
    console.warn("[TrackPlayerSafe] Failed to load enums:", error);
    return {};
  }
}