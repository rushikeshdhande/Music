import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { useTheme } from './src/hooks/useTheme';
import { useLiveActivitySync } from './src/hooks/useLiveActivity';
import { useMediaSessionSync } from './src/hooks/useMediaSessionSync';
import { applyGlobalFont } from './src/utils/globalFont';
import OtaUpdater from './src/components/OtaUpdater';

// ✅ Delete live-notification setup
import {
  setupDeleteNotificationChannel,
  registerDeleteNotificationEvents,
} from './src/services/notifications/deleteNotificationService';

applyGlobalFont();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Inner />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Inner() {
  const theme = useTheme();

  useLiveActivitySync();
  useMediaSessionSync(); // keeps the system media card / status-bar pill metadata fresh

  // Android 13+: without POST_NOTIFICATIONS the media notification never shows.
  // Also sets up the delete-progress notification channel + Cancel action.
  useEffect(() => {
    // ✅ Delete-progress channel + action category (safe to call multiple times)
    setupDeleteNotificationChannel().catch(() => {});
    registerDeleteNotificationEvents();

    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        const cur = await Notifications.getPermissionsAsync();
        if (!cur.granted && cur.canAskAgain) {
          await Notifications.requestPermissionsAsync();
        }
      } catch {}
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />

      {/* Check and download Production OTA updates */}
      <OtaUpdater />

      <View style={{ flex: 1 }}>
        <RootNavigator />
      </View>
    </View>
  );
}