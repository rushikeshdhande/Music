import { Platform, ToastAndroid, Alert } from 'react-native';

/**
 * System toast (Android native) — bottom ला दिसतो
 * iOS वर toast नाही, म्हणून Alert वापरतो (fallback)
 */

export function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // iOS वर system toast नाही — Alert fallback
    Alert.alert('', message);
  }
}

export function showLongToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
  } else {
    Alert.alert('', message);
  }
}

export function showToastWithGravity(
  message: string,
  gravity: 'top' | 'center' | 'bottom' = 'bottom'
) {
  if (Platform.OS === 'android') {
    const g =
      gravity === 'top'
        ? ToastAndroid.TOP
        : gravity === 'center'
        ? ToastAndroid.CENTER
        : ToastAndroid.BOTTOM;

    ToastAndroid.showWithGravity(message, ToastAndroid.SHORT, g);
  } else {
    Alert.alert('', message);
  }
}

/**
 * Shortcuts — success / error / info साठी
 */
export const toast = {
  success: (msg: string) => showToast(msg),
  error: (msg: string) => showToast(msg),
  info: (msg: string) => showToast(msg),
  long: (msg: string) => showLongToast(msg),
  center: (msg: string) => showToastWithGravity(msg, 'center'),
  top: (msg: string) => showToastWithGravity(msg, 'top'),
};