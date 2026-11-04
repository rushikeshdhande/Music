// src/components/OtaUpdater.tsx
import { useEffect } from "react";
import { AppState } from "react-native";
import * as Updates from "expo-updates";

export const getOtaInfo = () => ({
  enabled: Updates.isEnabled,
  channel: Updates.channel,
  runtimeVersion: Updates.runtimeVersion,
  updateId: Updates.updateId,
  isEmbeddedLaunch: Updates.isEmbeddedLaunch,
});

const MIN_GAP_MS = 30_000;

let lastCheckAt = 0;
let inFlight: Promise<void> | null = null;

async function runCheck(force = false): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  if (!force && Date.now() - lastCheckAt < MIN_GAP_MS) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    lastCheckAt = Date.now();
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) return;
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      console.log("[OTA] check failed:", e);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export default function OtaUpdater() {
  useEffect(() => {
    void runCheck();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void runCheck();
    });
    return () => sub.remove();
  }, []);

  return null;
}