// src/data/musicVideos.ts

export type MusicVideo = {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail: string;
  addedAt: number;
};

// Cloudinary can render a still frame of a video: same URL, .jpg extension.
// (Kept here in case you want to auto-generate thumbnails for future videos)
export const cloudinaryThumb = (url: string): string =>
  url
    .replace("/video/upload/", "/video/upload/so_8,w_640,h_360,c_fill,q_auto/")
    .replace(/\.mp4$/i, ".jpg");

const MAJBOOR_URL =
  "https://res.cloudinary.com/gwjb2ayo/video/upload/v1792785469/Majboor___Sheheryar_Rehan_x_Zoha_Waseem___Music_Video_2025___Aap_ka_he_kehna_banta_1080p.mp4";

// 👇 NEW: Your specific poster image for the Majboor video
const MAJBOOR_THUMBNAIL =
  "https://res.cloudinary.com/gwjb2ayo/image/upload/v1793086630/VS--YouTube-1020MajboorSheheryarRehanxZohaWaseemMusicVideo2025Aapkahekehnabanta-YouTube-2_32.jpg";

// To add more videos later, just push another object here.
export const MUSIC_VIDEOS: MusicVideo[] = [
  {
    id: "mv_majboor",
    title: "Majboor",
    artist: "Sheheryar Rehan & Zoha Wassem",
    url: MAJBOOR_URL,
    thumbnail: MAJBOOR_THUMBNAIL, // 👈 Using the new image URL here
    addedAt: 1761300000000,
  },
];
