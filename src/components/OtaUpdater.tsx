// src/components/OtaUpdater.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { AppState, Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import * as Updates from "expo-updates";

const DOWNLOAD_URL = "https://rushicdhande.vercel.app/music";
const MIN_GAP_MS = 30_000;

export const getOtaInfo = () => ({
  enabled: Updates.isEnabled,
  channel: Updates.channel,
  runtimeVersion: Updates.runtimeVersion,
  updateId: Updates.updateId,
  isEmbeddedLaunch: Updates.isEmbeddedLaunch,
});

export default function OtaUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const lastCheckAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const runCheck = useCallback(async (force = false): Promise<void> => {
    // 🔥 DIAGNOSTIC LOGS: Check your terminal/logcat for these messages
    if (__DEV__) {
      console.log("[OTA] Skipped: Running in development mode (__DEV__ is true).");
      return;
    }
    if (!Updates.isEnabled) {
      console.log("[OTA] Skipped: Updates are not enabled in this build.");
      return;
    }
    if (!force && Date.now() - lastCheckAt.current < MIN_GAP_MS) {
      console.log("[OTA] Skipped: Checking too frequently (MIN_GAP_MS).");
      return;
    }
    if (inFlight.current) {
      console.log("[OTA] Skipped: Check already in progress.");
      return inFlight.current;
    }

    inFlight.current = (async () => {
      lastCheckAt.current = Date.now();
      try {
        console.log("[OTA] Checking for update...");
        console.log(`[OTA] Current Channel: ${Updates.channel}`);
        console.log(`[OTA] Current Runtime Version: ${Updates.runtimeVersion}`);
        console.log(`[OTA] Is Embedded Launch: ${Updates.isEmbeddedLaunch}`);

        const res = await Updates.checkForUpdateAsync();
        
        if (res.isAvailable) {
          console.log("[OTA] ✅ Update is available!");
          setUpdateAvailable(true);
        } else {
          console.log("[OTA] ❌ No update available.");
        }
      } catch (e) {
        console.log("[OTA] Check failed with error:", e);
      } finally {
        inFlight.current = null;
      }
    })();

    return inFlight.current;
  }, []);

  useEffect(() => {
    // 1. Run check immediately on mount
    void runCheck();

    // 2. Listen to AppState changes to check when app comes to foreground
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        console.log("[OTA] App became active, checking for updates...");
        void runCheck();
      }
    });
    
    return () => sub.remove();
  }, [runCheck]);

  const handleDownload = () => {
    setUpdateAvailable(false);
    Linking.openURL(DOWNLOAD_URL).catch((err) => {
      console.error("Failed to open URL:", err);
    });
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={updateAvailable}
      onRequestClose={handleDismiss}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>New Update Available!</Text>
          
          <Text style={styles.modalText}>
            Please download the latest apk after 2pm
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.buttonDownload]}
            onPress={handleDownload}
          >
            <Text style={styles.textStyle}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonClose]}
            onPress={handleDismiss}
          >
            <Text style={styles.textStyle}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalView: {
    margin: 20,
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#3a3a3c",
    width: "85%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 15,
    textAlign: "center",
  },
  modalText: {
    marginBottom: 20,
    textAlign: "center",
    color: "#a1a1aa",
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    elevation: 2,
    width: "100%",
    marginBottom: 10,
  },
  buttonDownload: {
    backgroundColor: "#f92c47",
  },
  buttonClose: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3a3a3c",
  },
  textStyle: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});