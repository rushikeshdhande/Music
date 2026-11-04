// src/utils/globalFont.ts
import React from 'react';
import { Text, TextInput } from 'react-native';
import * as Font from 'expo-font';

/** Family name you will use everywhere via `fontFamily`. */
export const APP_FONT_FAMILY = 'NotoSans_sub';
/** Symbol / emoji-ish fallback font. */
export const SYMBOL_FONT_FAMILY = 'NotoSansSymbols';

/** Assets registered with expo-font (keys = the family names used in styles). */
export const FONTS: Record<string, number> = {
  [APP_FONT_FAMILY]: require('../../assets/fonts/NotoSans_sub.ttf'),
  [SYMBOL_FONT_FAMILY]: require('../../assets/fonts/NotoSansSymbols.otf'),
};

const DEFAULT_TEXT_STYLE = { fontFamily: APP_FONT_FAMILY };

let applied = false;

/**
 * Registers the fonts and forces them onto every <Text> / <TextInput>.
 * Safe to call multiple times (idempotent).
 */
export function applyGlobalFont(): void {
  if (applied) return;
  applied = true;

  // 1) Register fonts natively.
  //    If you also add the expo-font config plugin (see app.json below),
  //    the fonts are embedded in the binary and this call just returns fast.
  Font.loadAsync(FONTS).catch((err) => {
    if (__DEV__) console.warn('[globalFont] Failed to load fonts:', err);
  });

  // 2) Inject the font family into Text / TextInput.
  patchComponent(Text as any, DEFAULT_TEXT_STYLE);
  patchComponent(TextInput as any, DEFAULT_TEXT_STYLE);
}

function patchComponent(Component: any, style: any): void {
  if (!Component || Component.__globalFontPatched) return;
  Component.__globalFontPatched = true;

  // ---- Preferred: patch render() (class components — RN Text/TextInput) ----
  const originalRender = Component.render;
  if (typeof originalRender === 'function') {
    Component.render = function (...args: any[]) {
      const element = originalRender.apply(this, args);
      if (!element || !element.props) return element;
      return React.cloneElement(element, {
        // [defaultFont, userStyle] → user style always wins
        style: [style, element.props.style],
      });
    };
    return;
  }

  // ---- Fallback: defaultProps (forwardRef components / RN new-arch) ----
  Component.defaultProps = Component.defaultProps || {};
  Component.defaultProps.style = [
    style,
    Component.defaultProps.style,
  ].filter(Boolean);
}