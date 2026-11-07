// src/utils/fonts.ts
export const FONT = {
  regular: "Roboto-Regular",
  medium: "Roboto-Medium",
  bold: "Roboto-Bold",
  black: "Roboto-Black",
} as const;

export const FONT_REGULAR = FONT.regular;
export const FONT_MEDIUM = FONT.medium;
export const FONT_BOLD = FONT.bold;
export const FONT_BLACK = FONT.black;
export const FONT_SEMIBOLD = FONT.bold; // 600 not bundled → closest is Bold