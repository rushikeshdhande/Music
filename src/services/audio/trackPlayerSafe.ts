type TrackPlayerApi = Record<string, any>;

let cachedPlayer: TrackPlayerApi | null = null;

function loadPlayerModule(): any {
  const mod = require("@rntp/player");
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
    throw new Error("@rntp/player module is unavailable");
  }

  cachedPlayer = player as TrackPlayerApi;
  return cachedPlayer;
}

export function getTrackPlayerEnums(): {
  Event?: Record<string, any>;
  State?: Record<string, any>;
  RepeatMode?: Record<string, any>;
  Capability?: Record<string, any>;
  PlayerCommand?: Record<string, any>;
} {
  try {
    const mod = require("@rntp/player");

    return {
      Event: mod.Event,
      State: mod.State,
      RepeatMode: mod.RepeatMode,
      Capability: mod.Capability,
      PlayerCommand: mod.PlayerCommand,
    };
  } catch (error) {
    console.warn("[TrackPlayerSafe] Failed to load enums:", error);
    return {};
  }
}
