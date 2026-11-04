// src/utils/cleanArtistName.ts
const SITE_WORDS = [
  "pagalnew","pagalworld","pagalfree","pagalmovies","pagalsong","pagal",
  "djmaza","mrjatt","mr-jatt","songspk","wapking","webmusic","djpunjab",
  "djjohal","mp3mad","mp3song","mymp3song","freshmaza","musicmaza",
  "raagsong","bollywoodmp3","djyoungster","jiosaavn","hungama","gaana",
  "downloadming","songsmp3","sensongsmp3","pendujatt","jattmp3","newmp3",
  "mp3 download","free download",
];
const SITE_WORDS_RE = SITE_WORDS
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"))
  .join("|");
const TLDS =
  "com|net|org|in|co|se|pk|info|me|cc|ws|xyz|club|site|live|fm|mobi|io|app|top|online|tv|biz|us|uk";
const SEP = "[\\s_\\-–—|:@~•·]";

const RE_BRACKET_SITE = new RegExp(
  `[\\(\\[\\{<][^\\)\\]\\}>]*(?:${SITE_WORDS_RE}|\\.(?:${TLDS})\\b)[^\\)\\]\\}>]*[\\)\\]\\}>]`,
  "gi"
);
const RE_SITE_WORD = new RegExp(`${SEP}*(?:${SITE_WORDS_RE})(?:\\.[a-z0-9]+)*`, "gi");
const RE_WWW = /\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const RE_DOMAIN = new RegExp(`${SEP}*\\b[a-z0-9-]+\\.(?:${TLDS})(?:\\.[a-z]{2})?\\b`, "gi");
const RE_EDGE_SEP = new RegExp(`^${SEP}+|${SEP}+$`, "g");

export const UNKNOWN_ARTIST = "Unknown artist";

export const cleanSiteName = (raw?: string | null, keepOriginal = true): string => {
  if (!raw) return "";
  const original = String(raw).trim();
  if (!original) return "";
  const s = original
    .replace(RE_BRACKET_SITE, " ")
    .replace(RE_WWW, " ")
    .replace(RE_SITE_WORD, " ")
    .replace(RE_DOMAIN, " ")
    .replace(/_/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(RE_EDGE_SEP, "")
    .trim();
  if (!s) return keepOriginal ? original : "";
  return s;
};

export const isUnknownArtist = (a?: string | null): boolean => {
  if (!a) return true;
  const t = a.trim();
  if (!t) return true;
  return /^<?\s*unknown(\s+artist)?\s*>?$/i.test(t);
};

export const resolveArtistName = (
  raw?: string | null,
  tagged?: string | null,
): string => {
  const cleanedTagged = cleanSiteName(tagged, false);
  if (!isUnknownArtist(cleanedTagged)) return cleanedTagged;

  const cleanedRaw = cleanSiteName(raw, false);
  if (!isUnknownArtist(cleanedRaw)) return cleanedRaw;

  return UNKNOWN_ARTIST;
};