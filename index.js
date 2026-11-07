// index.js
import { registerRootComponent } from 'expo';
import TrackPlayer, { PlayerCommand } from '@rntp/player';
import App from './App';

TrackPlayer.registerPlaybackSession(async () => {
  // ---------- 1. Setup player ----------
  try {
    await TrackPlayer.setupPlayer({
      // ⭐ This is THE critical flag for capsule / lock-screen / notification.
      // Without 'music' the OS treats the notification as a generic one
      // and it will NOT show in ColorOS Aqua Dynamics or any media surface.
      contentType: 'music',

      // Pause when headphones unplugged / Bluetooth disconnects
      handleAudioBecomingNoisy: true,

      // Auto-pause on calls, auto-resume afterwards
      autoHandleInterruptions: true,

      android: {
        // ⭐ Keeps the foreground service + notification alive when the
        // user swipes the app away from recents. Without this the capsule
        // disappears the moment the app is removed from the recents list.
        taskRemovedBehavior: 'continue',
      },
    });
    console.log('[RNTP] Player ready');
  } catch (err) {
    // Expected on hot reload / resume — safe to ignore.
    console.log('[RNTP] setupPlayer skipped:', err?.message);
  }

  // ---------- 2. Remote commands (capsule / lock screen buttons) ----------
  try {
    await TrackPlayer.setCommands({
      capabilities: [
        PlayerCommand.PlayPause,   // play / pause toggle
        PlayerCommand.Next,        // skip forward
        PlayerCommand.Previous,    // skip back
        PlayerCommand.Seek,        // drag progress bar
        PlayerCommand.Stop,        // stop button
      ],
    });
    console.log('[RNTP] Commands registered');
  } catch (err) {
    console.log('[RNTP] setCommands failed:', err?.message);
  }
});

registerRootComponent(App);