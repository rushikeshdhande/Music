// src/icons/VideoIcons.tsx
// Extra icons used by the Music Videos feature.
// (Play / Pause / Forward / Backward / Ellipsis come from ./Icons as before.)
import React from "react";
import { Image } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

type P = { size?: number; color?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
});

const base56 = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 56 56",
  fill: "none" as const,
});

// ✅ Mute icon PNG — only used by `VolumeMuteIcon` (explicit caller).
const MUTE_IMG = require("../../assets/images/mutespecker.png");

export const BackIcon = ({ size = 26, color = "#fff" }: P) => (
  <Svg {...base(size)}>
    <Path
      d="M15 5l-7 7 7 7"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SearchIcon = ({ size = 20, color = "#fff" }: P) => (
  <Svg {...base(size)}>
    <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={2.2} />
    <Path
      d="M16 16l4.5 4.5"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
  </Svg>
);

export const ShuffleIcon = ({ size = 22, color = "#fff" }: P) => (
  <Svg {...base(size)}>
    <Path
      d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
      stroke={color}
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ExpandIcon = ({ size = 20, color = "#fff" }: P) => (
  <Svg {...base(size)}>
    <Path
      d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const CloseIcon = ({ size = 24, color = "#fff" }: P) => (
  <Svg {...base(size)}>
    <Path
      d="M6 6l12 12M18 6L6 18"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
    />
  </Svg>
);

// ────────────────────────────────────────────────────────────────────
// ✅ VolumeIcon — ALWAYS renders the speaker + 3 arcs SVG.
//   Arc opacity is derived from `level` (0..1):
//     level = 0            → speaker body only, all arcs hidden (opacity 0)
//     0 < level ≤ 0.45     → arc 1 full, arcs 2 & 3 dimmed
//     0.45 < level ≤ 0.75  → arcs 1 & 2 full, arc 3 dimmed
//     level > 0.75         → all 3 arcs full
//
//   ⚠️ The icon NEVER swaps to the PNG — that PNG is only rendered by
//      VolumeMuteIcon, which callers import explicitly if they want it.
// ────────────────────────────────────────────────────────────────────
export const VolumeIcon = ({
  size = 24,
  color = "#fff",
  level = 1,
}: {
  size?: number;
  color?: string;
  level?: number;
}) => {
  const v = Math.max(0, Math.min(1, level));

  // 72×48 viewBox scaled to `size` width (keeps aspect ratio).
  const w = size;
  const h = Math.round((size * 48) / 72);

  // Arc opacity by volume level.
  // At v = 0 → all arcs are invisible (only the speaker body shows).
  const arc1Opacity = v > 0 ? 1 : 0;
  const arc2Opacity = v > 0.45 ? 1 : v > 0 ? 0.28 : 0;
  const arc3Opacity = v > 0.75 ? 1 : v > 0 ? 0.28 : 0;

return (
  <Svg width={w} height={h} viewBox="0 0 72 48" fill="none">
    {/* Narrower speaker body */}
    <Path
      d="M3 17H10L24 3C26 1 29 3 29 6V42C29 45 26 47 24 45L10 31H3C1 31 0 29 0 27V21C0 19 1 17 3 17Z"
      fill={color}
    />

    {/* Arc 1 — reduced gap */}
    <Path
      d="M34 15C39 20 39 28 34 33"
      stroke={color}
      strokeWidth={5}
      strokeLinecap="round"
      opacity={arc1Opacity}
    />

    {/* Arc 2 */}
    <Path
      d="M43 9C52 17 52 31 43 39"
      stroke={color}
      strokeWidth={5}
      strokeLinecap="round"
      opacity={arc2Opacity}
    />

    {/* Arc 3 */}
    <Path
      d="M54 3C67 15 67 33 54 45"
      stroke={color}
      strokeWidth={5}
      strokeLinecap="round"
      opacity={arc3Opacity}
    />
  </Svg>
);

};

// ────────────────────────────────────────────────────────────────────
// VolumeMuteIcon — explicit mute PNG. Only rendered when a caller
// imports and uses this component directly. VolumeIcon never does.
// ────────────────────────────────────────────────────────────────────
export const VolumeMuteIcon = ({ size = 24, color = "#fff" }: P) => (
  <Image
    source={MUTE_IMG}
    style={{
      width: size,
      height: Math.round((size * 48) / 72),
      tintColor: color,
    }}
    resizeMode="contain"
    fadeDuration={0}
  />
);

// ─── 10s icons, split in two layers so ONLY the circle/arrow can rotate ────
const R_RING =
  "M 27.9999 54.4024 C 41.0546 54.4024 51.9063 43.5742 51.9063 30.4961 C 51.9063 18.9649 43.4687 9.1914 32.5234 7.0351 L 32.5234 3.7070 C 32.5234 2.0430 31.3749 1.5976 30.0858 2.5117 L 22.6093 7.7383 C 21.5546 8.4883 21.5312 9.6133 22.6093 10.3867 L 30.0624 15.6367 C 31.3749 16.5742 32.5234 16.1289 32.5234 14.4414 L 32.5234 11.0898 C 41.3827 13.1055 47.8983 21.0039 47.8983 30.4961 C 47.8983 41.5586 39.0390 50.4180 27.9999 50.4180 C 16.9374 50.4180 8.0546 41.5586 8.0780 30.4961 C 8.1014 23.8398 11.3358 17.9570 16.3280 14.3945 C 17.2890 13.6680 17.5936 12.5664 16.9843 11.5820 C 16.4218 10.6211 15.1327 10.3633 14.1014 11.1602 C 8.0546 15.5430 4.0937 22.6211 4.0937 30.4961 C 4.0937 43.5742 14.9218 54.4024 27.9999 54.4024 Z";
const R_DIGITS =
  "M 33.6483 40.3633 C 37.5390 40.3633 40.0936 36.6836 40.0936 31.0586 C 40.0936 25.3867 37.5390 21.6602 33.6483 21.6602 C 29.7577 21.6602 27.2030 25.3867 27.2030 31.0586 C 27.2030 36.6836 29.7577 40.3633 33.6483 40.3633 Z M 21.4374 40.0820 C 22.3514 40.0820 22.9374 39.4492 22.9374 38.4649 L 22.9374 23.7227 C 22.9374 22.5742 22.3280 21.8476 21.2733 21.8476 C 20.6405 21.8476 20.1952 22.0586 19.3514 22.6211 L 16.0936 24.8008 C 15.5780 25.1758 15.3202 25.5976 15.3202 26.1602 C 15.3202 26.9336 15.9296 27.5898 16.6796 27.5898 C 17.1249 27.5898 17.3358 27.4961 17.8046 27.1680 L 19.9843 25.5742 L 19.9843 38.4649 C 19.9843 39.4258 20.5702 40.0820 21.4374 40.0820 Z M 33.6483 37.5273 C 31.5858 37.5273 30.2499 35.0664 30.2499 31.0586 C 30.2499 26.9805 31.5624 24.4961 33.6483 24.4961 C 35.7577 24.4961 37.0234 26.9570 37.0234 31.0586 C 37.0234 35.0664 35.7343 37.5273 33.6483 37.5273 Z";
const F_RING =
  "M 27.9999 54.4024 C 41.0546 54.4024 51.9063 43.5742 51.9063 30.4961 C 51.9063 22.6211 47.9219 15.5430 41.8983 11.1602 C 40.8671 10.3633 39.5780 10.6211 38.9921 11.5820 C 38.4062 12.5664 38.7109 13.6680 39.6483 14.3945 C 44.6405 17.9570 47.8983 23.8398 47.9219 30.4961 C 47.9454 41.5586 39.0390 50.4180 27.9999 50.4180 C 16.9374 50.4180 8.1014 41.5586 8.1014 30.4961 C 8.1014 21.0039 14.6171 13.1055 23.4765 11.0898 L 23.4765 14.4649 C 23.4765 16.1289 24.6249 16.5742 25.8905 15.6602 L 33.3905 10.4102 C 34.4452 9.6836 34.4687 8.5586 33.3905 7.7851 L 25.9140 2.5351 C 24.6249 1.5976 23.4765 2.0430 23.4765 3.7305 L 23.4765 7.0351 C 12.5077 9.1680 4.0937 18.9649 4.0937 30.4961 C 4.0937 43.5742 14.9218 54.4024 27.9999 54.4024 Z";
const F_DIGITS =
  "M 33.6718 40.3633 C 37.5624 40.3633 40.0936 36.6836 40.0936 31.0586 C 40.0936 25.3867 37.5624 21.6602 33.6718 21.6602 C 29.7812 21.6602 27.2265 25.3867 27.2265 31.0586 C 27.2265 36.6836 29.7812 40.3633 33.6718 40.3633 Z M 21.4374 40.0820 C 22.3514 40.0820 22.9609 39.4492 22.9609 38.4649 L 22.9609 23.7227 C 22.9609 22.5742 22.3280 21.8476 21.2733 21.8476 C 20.6405 21.8476 20.2187 22.0586 19.3514 22.6211 L 16.1171 24.8008 C 15.5780 25.1758 15.3436 25.5976 15.3436 26.1602 C 15.3436 26.9336 15.9530 27.5898 16.7030 27.5898 C 17.1249 27.5898 17.3593 27.4961 17.8280 27.1680 L 20.0077 25.5742 L 20.0077 38.4649 C 20.0077 39.4258 20.5702 40.0820 21.4374 40.0820 Z M 33.6718 37.5273 C 31.5858 37.5273 30.2733 35.0664 30.2733 31.0586 C 30.2733 26.9805 31.5624 24.4961 33.6718 24.4961 C 35.7577 24.4961 37.0234 26.9570 37.0234 31.0586 C 37.0234 35.0664 35.7343 37.5273 33.6718 37.5273 Z";

export const Replay10Ring = ({ size = 44, color = "#fff" }: P) => (
  <Svg {...base56(size)}>
    <Path fill={color} d={R_RING} />
  </Svg>
);
export const Replay10Digits = ({ size = 44, color = "#fff" }: P) => (
  <Svg {...base56(size)}>
    <Path fill={color} d={R_DIGITS} />
  </Svg>
);
export const Forward10Ring = ({ size = 44, color = "#fff" }: P) => (
  <Svg {...base56(size)}>
    <Path fill={color} d={F_RING} />
  </Svg>
);
export const Forward10Digits = ({ size = 44, color = "#fff" }: P) => (
  <Svg {...base56(size)}>
    <Path fill={color} d={F_DIGITS} />
  </Svg>
);

// static (non-rotating) full icons
export const Replay10Icon = ({ size = 44, color = "#fff" }: P) => (
  <Svg {...base56(size)}>
    <Path fill={color} d={R_RING} />
    <Path fill={color} d={R_DIGITS} />
  </Svg>
);
export const Forward10Icon = ({ size = 44, color = "#fff" }: P) => (
  <Svg {...base56(size)}>
    <Path fill={color} d={F_RING} />
    <Path fill={color} d={F_DIGITS} />
  </Svg>
);
export const BackArrowIcon = ({ size = 24, color = "#fff" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 52 52" fill="none">
    <Path
      fill={color}
      d="M50,24H6.83L27.41,3.41a2,2,0,0,0,0-2.82,2,2,0,0,0-2.82,0l-24,24a1.79,1.79,0,0,0-.25.31A1.19,1.19,0,0,0,.25,25c0,.07-.07.13-.1.2l-.06.2a.84.84,0,0,0,0,.17,2,2,0,0,0,0,.78.84.84,0,0,0,0,.17l.06.2c0,.07.07.13.1.2a1.19,1.19,0,0,0,.09.15,1.79,1.79,0,0,0,.25.31l24,24a2,2,0,1,0,2.82-2.82L6.83,28H50a2,2,0,0,0,0-4Z"
    />
  </Svg>
);
export const CheckIcon = ({ size = 18, color = "#fff" }: P) => (
  <Svg {...base(size)}>
    <Path
      d="M5 12.5l4.5 4.5L19 7.5"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);