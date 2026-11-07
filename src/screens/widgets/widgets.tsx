import { NativeModules, Platform } from 'react-native';
import ImageColors from 'react-native-image-colors'; // or 'expo-image-colors'

const { WidgetModule } = NativeModules;

export const updateNowPlayingWidget = async (
  title: string,
  artist: string,
  isPlaying: boolean,
  albumArtUrl: string
) => {
  if (Platform.OS === 'android' && WidgetModule) {
    try {
      let hexColor = '#2B2E3A'; // Default color if extraction fails

      if (albumArtUrl) {
        // Extract the dominant color from the album art
        const colors = await ImageColors.getColors(albumArtUrl, {
          fallback: hexColor,
          cache: true,
        });

        if (colors.platform === 'android') {
          // Use dominant or vibrant color
          hexColor = colors.dominant || hexColor;
        }
      }

      // Pass everything to the Native Module
      WidgetModule.updateNowPlaying(title, artist, isPlaying, hexColor, albumArtUrl);
    } catch (error) {
      console.warn('Failed to update Now Playing widget:', error);
    }
  }
};