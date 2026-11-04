// index.js
import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';

// Register the service so background controls (lock screen, notification) work.
// Note the `.default` at the end, because we are using ES modules in the service file.
TrackPlayer.registerPlaybackService(() => require('./src/services/playbackService').default);

registerRootComponent(App);