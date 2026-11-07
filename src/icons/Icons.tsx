import React from "react";
import { Image } from "react-native";
import Svg, { Path, Circle, Rect, Line } from "react-native-svg";

export const ICON_COLOR = "#f92c47";
export const NAVBAR_ICON_COLOR = "#98989e";
export const NAVBAR_ICON_ACTIVE = "#f92c47";
export const PLAYER_ICON_COLOR = "#fff";

type IconProps = { size?: number; color?: string };
type HeartProps = IconProps & { filled?: boolean };

// ── Player icon set from assets/apple/ ─────────────────────
const PLAY_PNG = require("../../assets/apple/playicon.png");
const PAUSE_PNG = require("../../assets/apple/pause_icon_transparent.png");
const FAST_FORWARD_PNG = require("../../assets/apple/fastforwardicon.png");
const FAST_BACKWARD_PNG = require("../../assets/apple/fastbackwardicon.png");
const CAST_PNG = require("../../assets/apple/casticon.png");
const LYRICS_PNG = require("../../assets/apple/lyricsicon.png");
const QUEUE_PNG = require("../../assets/apple/queueicon.png");
const MORE_PNG = require("../../assets/apple/moreicon.png");

// ── Existing assets ─────────────────────────────────────────
const STAR_PNG = require("../../assets/icons/star-icon.png");
const MUSIC_DEFAULT_PNG = require("../../assets/images/musicdefault.png");

// ── Play / Pause / Forward / Backward ───────────────────────
export const PlayIcon = ({
  size = 28,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Image
    source={PLAY_PNG}
    style={{
      width: size,
      height: size * (28 / 32),
      tintColor: color,
    }}
    resizeMode="contain"
  />
);


// ── Four-line Menu Icon ────────────────────────────────────
export const MenuIcon = ({
  size = 24,
  color = NAVBAR_ICON_COLOR,
}: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 15 15"
    fill="none"
    accessible
    accessibilityRole="image"
    accessibilityLabel="Menu"
  >
    <Path
      d="M1.5 1.5H13.5 M1.5 5.5H13.5 M1.5 9.5H13.5 M1.5 13.5H13.5"
      stroke={color}
      strokeWidth={1}
      strokeLinecap="round"
    />
  </Svg>
);

// ── Pin Song ────────────────────────────────────────────────
export const PinSongIcon = ({
  size = 24,
  color = NAVBAR_ICON_COLOR,
}: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="-8 -8 80 80"
    fill={color}
    accessible
    accessibilityRole="image"
    accessibilityLabel="Pin Song"
  >
    <Path
      fill={color}
      d="M32.2 62c.6 0 2.3-3.3 2.3-7.3v-14h-4.6v14c0 4 1.7 7.3 2.3 7.3M16 42.8h32.4c2.3 0 3.8-1.5 3.8-3.7 0-7.5-8.5-15.1-20-15.1s-20 7.6-20 15.1c0 2.2 1.5 3.7 3.8 3.7m1-4c-.5 0-.8-.2-.7-1 .5-4.6 6.5-10 15.9-10s15.3 5.4 15.9 10c0 .8-.2 1-.8 1zm-1.5-34a4 4 0 0 0 1 2.5c1.3 1.7 4.4 4.1 7.6 6.3l-1 13.5h4.2l1-15.4c0-.4 0-.5-.3-.7-4-2-7-4.3-7-4.8-.3-.3 0-.5.2-.5h22c.2 0 .5.2.3.5a25 25 0 0 1-7.1 4.8c-.2.2-.3.3-.2.7L37 27h4l-.9-13.5a37 37 0 0 0 7.7-6.3 4 4 0 0 0 1-2.5c0-1.6-1.2-2.7-3-2.7H18.5c-1.8 0-3 1.1-3 2.7Z"
    />
  </Svg>
);

// ── User playlist (list + music note) ───────────────────────
export const UserPlaylistIcon = ({
  size = 24,
  color = ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fill={color}
      d="M13.079 19.712c1.076 0 2.688-.79 2.688-2.922v-6.702c0-.388.073-.468.417-.542l3.347-.732a.48.48 0 0 0 .403-.483V5.577c0-.388-.315-.637-.688-.564l-3.765.82c-.469.103-.725.359-.725.77l.015 8.144c.036.359-.132.593-.455.659l-1.164.242c-1.465.307-2.153 1.054-2.153 2.16 0 1.12.864 1.904 2.08 1.904M12.046 8.675a.503.503 0 0 0 .498-.498.497.497 0 0 0-.498-.49H5.498a.49.49 0 0 0-.498.49.5.5 0 0 0 .498.498zm0 2.607a.5.5 0 0 0 .498-.505.49.49 0 0 0-.498-.483H5.498a.486.486 0 0 0-.498.483c0 .278.212.505.498.505zm0 2.608a.494.494 0 1 0 0-.989H5.498a.49.49 0 0 0-.498.49.49.49 0 0 0 .498.499z"
    />
  </Svg>
);

export const PauseIcon = ({
  size = 28,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Image
    source={PAUSE_PNG}
    style={{
      width: size,
      height: size * (28 / 32),
      tintColor: color,
    }}
    resizeMode="contain"
  />
);

export const ForwardIcon = ({
  size = 28,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Image
    source={FAST_FORWARD_PNG}
    style={{
      width: size,
      height: size * (28 / 32),
      tintColor: color,
    }}
    resizeMode="contain"
  />
);

export const BackwardIcon = ({
  size = 28,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Image
    source={FAST_BACKWARD_PNG}
    style={{
      width: size,
      height: size * (28 / 32),
      tintColor: color,
    }}
    resizeMode="contain"
  />
);

// ── Cast / Lyrics / Queue ───────────────────────────────────
export const CastIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Image
    source={CAST_PNG}
    style={{ width: size, height: size, tintColor: color }}
    resizeMode="contain"
  />
);

export const LyricsIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Image
    source={LYRICS_PNG}
    style={{ width: size, height: size, tintColor: color }}
    resizeMode="contain"
  />
);

export const QueueIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Image
    source={QUEUE_PNG}
    style={{ width: size, height: size, tintColor: color }}
    resizeMode="contain"
  />
);

// ── Ellipsis (three-dot) ────────────────────────────────────
export const EllipsisIcon = ({ size = 24, color = ICON_COLOR }: IconProps) => (
  <Image
    source={MORE_PNG}
    style={{ width: size, height: size, tintColor: color }}
    resizeMode="contain"
  />
);


// --------------------------- navigation icons ---------------------------


export const HomeIcon = ({
  size = 24,
}: IconProps) => (
  <Image
    source={require('../../assets/icons/home.png')}
    style={{
      width: size,
      height: size,
      resizeMode: 'contain',
    }}
  />
);

// ── New (grid of squares) ──────────────────────────────────
export const NewIcon = ({
  size = 24,
  color = NAVBAR_ICON_COLOR,
}: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    accessible
    accessibilityRole="image"
    accessibilityLabel="New"
  >
    <Path
      fill={color}
      fillOpacity={0.95}
      d="M9.92 11.354c.966 0 1.453-.487 1.453-1.49v-3.4c0-1.004-.487-1.483-1.453-1.483H6.452C5.487 4.981 5 5.46 5 6.464v3.4c0 1.003.487 1.49 1.452 1.49zm7.628 0c.965 0 1.452-.487 1.452-1.49v-3.4c0-1.004-.487-1.483-1.452-1.483h-3.46c-.974 0-1.46.479-1.46 1.483v3.4c0 1.003.486 1.49 1.46 1.49zm-7.65-1.073h-3.43q-.397.002-.396-.418v-3.4q-.002-.41.396-.41h3.43c.265 0 .402.137.402.41v3.4c0 .281-.137.418-.403.418m7.634 0h-3.43c-.273 0-.402-.137-.402-.418v-3.4c0-.273.129-.41.403-.41h3.43q.396 0 .395.41v3.4q.002.42-.396.418m-7.612 8.7c.966 0 1.453-.48 1.453-1.483v-3.407c0-.996-.487-1.483-1.453-1.483H6.452c-.965 0-1.452.487-1.452 1.483v3.407c0 1.004.487 1.483 1.452 1.483zm7.628 0c.965 0 1.452-.48 1.452-1.483v-3.407c0-.996-.487-1.483-1.452-1.483h-3.46c-.974 0-1.46.487-1.46 1.483v3.407c0 1.004.486 1.483 1.46 1.483zm-7.65-1.072h-3.43q-.397 0-.396-.41v-3.4c0-.282.13-.418.396-.418h3.43c.265 0 .402.136.402.418v3.4c0 .273-.137.41-.403.41m7.634 0h-3.43c-.273 0-.402-.137-.402-.41v-3.4c0-.282.129-.418.403-.418h3.43c.265 0 .395.136.395.418v3.4q.002.41-.396.41"
    />
  </Svg>
);

// ── Radio (broadcast waves) ────────────────────────────────
export const RadioIcon = ({
  size = 24,
  color = NAVBAR_ICON_COLOR,
}: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    accessible
    accessibilityRole="image"
    accessibilityLabel="Radio"
  >
    <Path
      fill={color}
      d="M19.359 18.57C21.033 16.818 22 14.461 22 11.89s-.967-4.93-2.641-6.68c-.276-.292-.653-.26-.868-.023-.222.246-.176.591.085.868 1.466 1.535 2.272 3.593 2.272 5.835s-.806 4.3-2.272 5.835c-.261.268-.307.621-.085.86.215.245.592.276.868-.016zm-13.85.014c.222-.238.176-.59-.085-.86-1.474-1.535-2.272-3.593-2.272-5.834 0-2.242.798-4.3 2.272-5.835.261-.277.307-.622.085-.868-.215-.238-.592-.269-.868.023C2.967 6.96 2 9.318 2 11.89s.967 4.929 2.641 6.68c.276.29.653.26.868.014m1.957-1.873c.223-.253.162-.583-.1-.867-.951-1.068-1.473-2.45-1.473-3.954s.522-2.887 1.474-3.954c.26-.284.322-.614.1-.876-.23-.26-.622-.26-.891.039-1.175 1.274-1.827 2.963-1.827 4.79 0 1.82.652 3.517 1.827 4.784.269.3.66.307.89.038m9.958-.038c1.175-1.267 1.827-2.964 1.827-4.783 0-1.828-.652-3.517-1.827-4.791-.269-.3-.66-.3-.89-.039-.23.262-.162.592.092.876.96 1.067 1.481 2.449 1.481 3.954 0 1.504-.522 2.886-1.481 3.954-.254.284-.323.614-.092.867.23.269.621.261.89-.038m-8.061-1.966c.23-.26.13-.568-.092-.883-.415-.522-.63-1.197-.63-1.934s.215-1.413.63-1.943c.222-.307.322-.614.092-.875s-.653-.261-.906.054a4.4 4.4 0 0 0-.968 2.764 4.38 4.38 0 0 0 .968 2.756c.253.322.675.322.906.061m6.18-.061a4.38 4.38 0 0 0 .968-2.756 4.4 4.4 0 0 0-.968-2.764c-.253-.315-.675-.315-.906-.054s-.138.568.092.875c.415.53.63 1.206.63 1.943s-.215 1.412-.63 1.934c-.23.315-.322.622-.092.883s.653.261.906-.061m-3.547-.967c.96 0 1.789-.814 1.789-1.797s-.83-1.789-1.789-1.789c-.96 0-1.781.806-1.781 1.789s.821 1.797 1.781 1.797"
    />
  </Svg>
);

// ── Legacy skip icons (kept for backwards compatibility) ────
export const SkipNextIcon = ({
  size = 24,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 6l8.5 6L6 18zM15 6h2v12h-2z" fill={color} />
  </Svg>
);

export const SkipPrevIcon = ({
  size = 24,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M18 6l-8.5 6L18 18zM7 6h2v12H7z" fill={color} />
  </Svg>
);

// ── Shuffle / Repeat ────────────────────────────────────────
export const ShuffleIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size * (14 / 18)} viewBox="0 0 18 14">
    <Path
      fill={color}
      d="M.012 10.903c0 .43.333.732.79.732H2.54c1.272 0 2.019-.37 2.89-1.397l1.79-2.13 1.767 2.093c.894 1.065 1.737 1.434 3.009 1.434h1.478v1.782c0 .355.214.562.57.562.162 0 .31-.06.435-.155l2.898-2.418c.281-.23.281-.584 0-.828L14.48 8.161a.67.67 0 0 0-.436-.156c-.355 0-.569.2-.569.562v1.597H12.04c-.872 0-1.442-.288-2.07-1.042L8.166 6.985l1.811-2.144c.643-.761 1.161-1.035 2.019-1.035h1.478v1.627c0 .355.214.562.57.562.162 0 .31-.06.435-.156l2.898-2.417c.281-.23.281-.584 0-.828L14.48.177a.67.67 0 0 0-.436-.156c-.355 0-.569.2-.569.562v1.745h-1.471c-1.316 0-2.122.362-3.06 1.486L7.22 5.862l-1.79-2.13c-.87-1.027-1.67-1.397-2.933-1.397H.803c-.458 0-.791.303-.791.732s.333.74.79.74h1.635c.828 0 1.404.288 2.04 1.042l1.797 2.136-1.797 2.137c-.636.754-1.168 1.042-1.988 1.042H.803c-.458 0-.791.31-.791.74Z"
    />
  </Svg>
);

export const RepeatIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"
      fill={color}
    />
  </Svg>
);

// ── Star / Heart ────────────────────────────────────────────
export const StarIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
  filled = false,
}: HeartProps) => (
  <Image
    source={STAR_PNG}
    style={{
      width: size,
      height: size,
      tintColor: filled ? color : undefined,
      opacity: filled ? 1 : 0.8,
    }}
    resizeMode="contain"
  />
);

export const HeartIcon = StarIcon;

// ── Navigation ──────────────────────────────────────────────
export const BackIcon = ({
  size = 24,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M15 4l-8 8 8 8"
      stroke={color}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ChevronRightIcon = ({
  size = 22,
  color = NAVBAR_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M9 4l8 8-8 8"
      stroke={color}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SearchIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={2} fill="none" />
    <Line
      x1="16.5"
      y1="16.5"
      x2="21"
      y2="21"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export const MoreIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="5" cy="12" r="2" fill={color} />
    <Circle cx="12" cy="12" r="2" fill={color} />
    <Circle cx="19" cy="12" r="2" fill={color} />
  </Svg>
);

export const MusicNoteIcon = ({
  size = 24,
  color = NAVBAR_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M9 18V6l10-2v12"
      stroke={color}
      strokeWidth={2}
      fill="none"
      strokeLinejoin="round"
    />
    <Circle cx="6.5" cy="18" r="2.5" fill={color} />
    <Circle cx="16.5" cy="16" r="2.5" fill={color} />
  </Svg>
);

export const SettingsIcon = ({
  size = 24,
  color = NAVBAR_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M19.14 12.94a7.07 7.07 0 000-1.88l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.03 7.03 0 00-1.63-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.5.5 0 00-.6.22L2.65 8.84a.5.5 0 00.12.64l2.03 1.58a7.07 7.07 0 000 1.88L2.77 14.52a.5.5 0 00-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z"
      fill={color}
    />
  </Svg>
);

export const ShareIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle
      cx="6"
      cy="12"
      r="2.4"
      stroke={color}
      strokeWidth={1.8}
      fill="none"
    />
    <Circle
      cx="18"
      cy="6"
      r="2.4"
      stroke={color}
      strokeWidth={1.8}
      fill="none"
    />
    <Circle
      cx="18"
      cy="18"
      r="2.4"
      stroke={color}
      strokeWidth={1.8}
      fill="none"
    />
    <Line x1="8" y1="11" x2="16" y2="7" stroke={color} strokeWidth={1.8} />
    <Line x1="8" y1="13" x2="16" y2="17" stroke={color} strokeWidth={1.8} />
  </Svg>
);

export const TrashIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"
      stroke={color}
      strokeWidth={1.8}
      fill="none"
      strokeLinecap="round"
    />
  </Svg>
);

export const InfoIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle
      cx="12"
      cy="12"
      r="9"
      stroke={color}
      strokeWidth={1.8}
      fill="none"
    />
    <Rect x="11" y="10" width="2" height="7" fill={color} />
    <Circle cx="12" cy="7.5" r="1.2" fill={color} />
  </Svg>
);

export const ScanIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3M3 12h18"
      stroke={color}
      strokeWidth={1.8}
      fill="none"
      strokeLinecap="round"
    />
  </Svg>
);

export const SpeedIcon = ({
  size = 22,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle
      cx="12"
      cy="12"
      r="9"
      stroke={color}
      strokeWidth={1.8}
      fill="none"
    />
    <Line
      x1="12"
      y1="12"
      x2="16"
      y2="8"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

// ── Go back (arrow left) ────────────────────────────────────
export const GoBackIcon = ({
  size = 24,
  color = PLAYER_ICON_COLOR,
}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      fill={color}
      d="M11.7071 4.29289C12.0976 4.68342 12.0976 5.31658 11.7071 5.70711L6.41421 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H6.41421L11.7071 18.2929C12.0976 18.6834 12.0976 19.3166 11.7071 19.7071C11.3166 20.0976 10.6834 20.0976 10.2929 19.7071L3.29289 12.7071C3.10536 12.5196 3 12.2652 3 12C3 11.7348 3.10536 11.4804 3.29289 11.2929L10.2929 4.29289C10.6834 3.90237 11.3166 3.90237 11.7071 4.29289Z"
    />
  </Svg>
);

// ── Apple logo ──────────────────────────────────────────────
export const AppleLogo = ({
  size = 26,
  color = "#98989e",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill={color}
      d="M11.6734 7.22198C10.7974 7.22198 9.44138 6.22598 8.01338 6.26198C6.12938 6.28598 4.40138 7.35397 3.42938 9.04597C1.47338 12.442 2.92538 17.458 4.83338 20.218C5.76938 21.562 6.87338 23.074 8.33738 23.026C9.74138 22.966 10.2694 22.114 11.9734 22.114C13.6654 22.114 14.1454 23.026 15.6334 22.99C17.1454 22.966 18.1054 21.622 19.0294 20.266C20.0974 18.706 20.5414 17.194 20.5654 17.11C20.5294 17.098 17.6254 15.982 17.5894 12.622C17.5654 9.81397 19.8814 8.46998 19.9894 8.40998C18.6694 6.47798 16.6414 6.26198 15.9334 6.21398C14.0854 6.06998 12.5374 7.22198 11.6734 7.22198ZM14.7934 4.38998C15.5734 3.45398 16.0894 2.14598 15.9454 0.849976C14.8294 0.897976 13.4854 1.59398 12.6814 2.52998C11.9614 3.35798 11.3374 4.68998 11.5054 5.96198C12.7414 6.05798 14.0134 5.32598 14.7934 4.38998Z"
    />
  </Svg>
);

export const AppleIcon = AppleLogo;

// ── Artwork placeholder ─────────────────────────────────────
export const ArtworkPlaceholder = ({
  size = 52,
  radius = 10,
  color = "#98989e",
  bg = "#2a2a29",
  fallbackToApple = false,
}: {
  size?: number;
  radius?: number;
  color?: string;
  bg?: string;
  fallbackToApple?: boolean;
}) => {
  return (
    <Image
      source={MUSIC_DEFAULT_PNG}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
      }}
      resizeMode="cover"
      fadeDuration={0}
    />
  );
};

export const MUSIC_DEFAULT_IMAGE = MUSIC_DEFAULT_PNG;

// ── Welcome Apple Music logo ─────────────────────────────────
export const WelcomeApple = ({ size = 168.6, color = "#fff" }: IconProps) => (
  <Svg
    width={size}
    height={size * (20.7 / 84.3)}
    viewBox="0 0 84.3 20.7"
    fill={color}
    accessible
    accessibilityRole="image"
    accessibilityLabel="Apple Music"
  >
    <Path d="M35.4 20.1V6.6h-.1l-5.4 13.5h-2.1L22.4 6.6h-.1v13.5h-2.5V1.8H23l5.8 14.6h.1l5.8-14.6H38v18.3h-2.6zm16.7 0h-2.6v-2.3h-.1c-.7 1.6-2.1 2.5-4.1 2.5-2.9 0-4.6-1.9-4.6-5V6.7h2.7v8.1c0 2 1 3.1 2.8 3.1 2 0 3.1-1.4 3.1-3.5V6.7H52l.1 13.4zm7.4-13.6c3.1 0 5 1.7 5.1 4.2h-2.5c-.2-1.3-1.1-2.1-2.6-2.1s-2.5.7-2.5 1.8c0 .8.6 1.4 2 1.7l2.1.5c2.7.6 3.7 1.7 3.7 3.6 0 2.4-2.2 4.1-5.3 4.1-3.3 0-5.3-1.6-5.5-4.2h2.7c.2 1.4 1.2 2.1 2.8 2.1 1.6 0 2.6-.7 2.6-1.8 0-.9-.5-1.4-1.9-1.7l-2.1-.5c-2.5-.6-3.7-1.8-3.7-3.8 0-2.3 2-3.9 5.1-3.9zm7.3-3.3c0-.9.7-1.6 1.6-1.6.9 0 1.6.7 1.6 1.6 0 .9-.7 1.6-1.6 1.6-.9 0-1.6-.7-1.6-1.6zm.2 3.5h2.7v13.4H67V6.7zm14.1 4.6c-.3-1.4-1.3-2.6-3.1-2.6-2.1 0-3.5 1.8-3.5 4.6 0 2.9 1.4 4.6 3.5 4.6 1.7 0 2.7-.9 3.1-2.5h2.6c-.3 2.8-2.5 4.8-5.7 4.8-3.8 0-6.2-2.6-6.2-6.9 0-4.2 2.4-6.9 6.2-6.9 3.4 0 5.4 2.2 5.7 4.8l-2.6.1zM11.5 3.6c-.7.8-1.8 1.5-2.9 1.4-.2-1.2.4-2.4 1-3.1.7-.9 1.9-1.5 2.9-1.5.1 1.1-.3 2.3-1 3.2zm1 1.6c.6 0 2.4.2 3.6 2C16 7.3 14 8.5 14 11c0 3 2.6 4 2.6 4 0 .1-.4 1.4-1.3 2.8-.8 1.2-1.7 2.4-3 2.4s-1.7-.8-3.2-.8c-1.5 0-2 .8-3.2.8-1.3 0-2.3-1.3-3.1-2.5-1.7-2.5-3-7-1.2-10 .8-1.5 2.4-2.5 4-2.5 1.3 0 2.5.9 3.2.9.7 0 2.1-1 3.7-.9z" />
  </Svg>
);

export const WelcomeAppleSvg = WelcomeApple;