import { Platform, PermissionsAndroid } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

export interface PermissionReport {
  audio: boolean;
  storageAll: boolean;
  notifications: boolean;
}

export async function getAudioPermission(): Promise<boolean> {
  try {
    let res: any = await MediaLibrary.getPermissionsAsync(true, ['audio']);

    if (res.granted) return true;

    if (res.canAskAgain) {
      res = await MediaLibrary.requestPermissionsAsync(true, ['audio']);
      return !!res.granted;
    }

    return false;
  } catch (error) {
    console.warn('[Permission] Audio permission failed:', error);
    return false;
  }
}

export async function getStorageAllPermission(): Promise<boolean> {
  try {
    const res: any = await MediaLibrary.getPermissionsAsync();
    return !!res.granted;
  } catch {
    return false;
  }
}

// Android 13+ asks at runtime. The "now playing" notification is what keeps
// background audio playback alive, so this one matters.
export async function getNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;

    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (already) return true;

    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('[Permission] Notification permission failed:', error);
    return false;
  }
}

export async function openAppSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android' && Application.applicationId) {
      await IntentLauncher.startActivityAsync(
        'android.settings.APPLICATION_DETAILS_SETTINGS',
        { data: `package:${Application.applicationId}` }
      );
    }
  } catch (error) {
    console.warn('[Permission] Could not open app settings:', error);
  }
}

export async function openManageAllFilesSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android' && Application.applicationId) {
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        { data: `package:${Application.applicationId}` }
      );
    }
  } catch (error) {
    console.warn('[Permission] Could not open all-files settings:', error);
  }
}

export async function requestAll(): Promise<PermissionReport> {
  const [audio, storageAll, notifications] = await Promise.all([
    getAudioPermission(),
    getStorageAllPermission(),
    getNotificationPermission(),
  ]);

  return {
    audio,
    storageAll,
    notifications,
  };
}