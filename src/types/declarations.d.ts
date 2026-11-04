declare module 'expo-music-info-2' {
  export interface MusicInfoOptions {
    title?: boolean;
    artist?: boolean;
    album?: boolean;
    genre?: boolean;
    year?: boolean;
    trackNumber?: boolean;
    picture?: boolean;
  }

  export interface MusicInfoResult {
    title?: string;
    artist?: string;
    album?: string;
    picture?: {
      pictureData: string;
    };
  }

  const MusicInfo: {
    getMusicInfoAsync: (
      fileUri: string,
      options?: MusicInfoOptions
    ) => Promise<MusicInfoResult | null>;
  };

  export default MusicInfo;
}