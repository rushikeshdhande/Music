
import { useEffect, useRef } from "react";
import { Alert, AppState, Linking } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

const VERSION_CHECK_URL =
  "https://rushicdhande.vercel.app/music/version.json";

const MIN_GAP_MS = 30_000;

type RemoteVersionInfo = {
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
};

export const getOtaInfo = () => ({
  enabled: Updates.isEnabled,
  channel: Updates.channel,
  runtimeVersion: Updates.runtimeVersion,
  updateId: Updates.updateId,
  isEmbeddedLaunch: Updates.isEmbeddedLaunch,
});

function isNewVersionAvailable(
  current: string,
  latest: string
) {
  const a = current.split(".").map(Number);
  const b = latest.split(".").map(Number);

  if (
    [...a, ...b].some(
      (value) => !Number.isInteger(value) || value < 0
    )
  ) {
    return false;
  }

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;

    if (y > x) return true;
    if (y < x) return false;
  }

  return false;
}

export async function checkForUpdatesManually() {
  if (__DEV__ || !Updates.isEnabled) {
    Alert.alert("OTA disabled", JSON.stringify(getOtaInfo(), null, 2));
    return;
  }

  try {
    const result = await Updates.checkForUpdateAsync();

    if (!result.isAvailable) {
      Alert.alert("No OTA Update", "You are using the latest available update.");
      return;
    }

    await Updates.fetchUpdateAsync();

    Alert.alert("OTA Update Ready", "Restart the app to apply the changes.", [
      { text: "Later", style: "cancel" },
      {
        text: "Restart App",
        onPress: () => void Updates.reloadAsync(),
      },
    ]);
  } catch (error: any) {
    Alert.alert("OTA Error", String(error?.message ?? error));
  }
}

export default function OtaUpdater() {
  const busy = useRef(false);
  const lastCheck = useRef(0);
  const promptedVersion = useRef<string | null>(null);

  useEffect(() => {
    const checkOta = async () => {
      if (!Updates.isEnabled) return;

      try {
        const result = await Updates.checkForUpdateAsync();

        if (!result.isAvailable) return;

        await Updates.fetchUpdateAsync();

        Alert.alert(
          "OTA Update Ready",
          "Restart the app to apply the changes.",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart App",
              onPress: () => void Updates.reloadAsync(),
            },
          ]
        );
      } catch (error) {
        console.log("[OTA] Update check failed:", error);
      }
    };

    const checkUpdates = async () => {
      if (__DEV__ || busy.current) return;
      if (Date.now() - lastCheck.current < MIN_GAP_MS) return;

      busy.current = true;
      lastCheck.current = Date.now();

      try {
        const currentVersion =
          Constants.nativeAppVersion ??
          Constants.expoConfig?.version ??
          "0.0.0";

        const response = await fetch(
          `${VERSION_CHECK_URL}?t=${Date.now()}`,
          {
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Version check failed: ${response.status}`);
        }

        const remote: RemoteVersionInfo = await response.json();

        if (!remote.latestVersion || !remote.downloadUrl) {
          throw new Error("Invalid version.json");
        }

        console.log("[APP VERSION CHECK]", {
          currentVersion,
          latestVersion: remote.latestVersion,
        });

        if (
          isNewVersionAvailable(
            currentVersion,
            remote.latestVersion
          )
        ) {
          if (promptedVersion.current !== remote.latestVersion) {
            promptedVersion.current = remote.latestVersion;

            Alert.alert(
              "New App Version Available",
              `Music ${remote.latestVersion} is available.\n\n${
                remote.releaseNotes ??
                "Update to get the latest features and improvements."
              }`,
              [
                {
                  text: "Download Update",
                  onPress: () => {
                    void Linking.openURL(remote.downloadUrl);
                  },
                },
              ],
              { cancelable: false }
            );
          }

          return;
        }

        await checkOta();
      } catch (error) {
        console.log("[APP VERSION CHECK] Failed:", error);
        await checkOta();
      } finally {
        busy.current = false;
      }
    };

    void checkUpdates();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void checkUpdates();
      }
    });

    return () => subscription.remove();
  }, []);

  return null;
}
