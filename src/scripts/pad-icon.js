// src/scripts/pad-icon.js
// Builds:
//   assets/images/applogo-adaptive.png  -> Android adaptive icon foreground
//   assets/images/applogo-icon.png      -> normal app icon (iOS + legacy Android)
// Source image: assets/images/appicon.png
// Splash image: assets/images/splashscreenicon.png (wired into app.json)
//
// Usage:  node src/scripts/pad-icon.js          (regenerate icons only)
//         node src/scripts/pad-icon.js --bump   (also bump android.versionCode)
//
// GLYPH_* = how much of the canvas the logo's longest side may fill.
//   Adaptive icons get masked (circle/squircle), keep it <= 0.55
//   Normal icon: 0.40 = small, 0.50 = medium, 0.62 = large
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const ROOT     = path.resolve(__dirname, '..', '..');
const INPUT    = path.join(ROOT, 'assets', 'images', 'appicon.png');
const OUTPUT   = path.join(ROOT, 'assets', 'images', 'applogo-adaptive.png');
const NORMAL   = path.join(ROOT, 'assets', 'images', 'applogo-icon.png');
const SPLASH   = path.join(ROOT, 'assets', 'images', 'splashscreenicon.png');
const APP_JSON = path.join(ROOT, 'app.json');

const CANVAS         = 1024;
const GLYPH_ADAPTIVE = 0.36;
const GLYPH_NORMAL   = 0.36;
const TRIM_THRESHOLD = 100;   // ignore faint gray artifacts near the edges

// Set to e.g. { r: 0, g: 0, b: 0 } to force a background colour.
// Leave null to auto-detect from the top-left corner of appicon.png.
const BG_OVERRIDE = null;

// Splash screen background colours (light mode / dark mode)
const SPLASH_BG_LIGHT = '#000000';
const SPLASH_BG_DARK  = '#000000';

const toHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

async function detectBackground() {
  if (BG_OVERRIDE) return BG_OVERRIDE;
  const { data, info } = await sharp(INPUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const off = (4 * info.width + 4) * 4;       // pixel at (4,4)
  if (data[off + 3] < 128) return { r: 0, g: 0, b: 0 }; // transparent -> black
  return { r: data[off], g: data[off + 1], b: data[off + 2] };
}

async function buildIcon(trimmed, bg, glyphFraction, outFile) {
  const box = Math.round(CANVAS * glyphFraction);
  // fit 'inside' = whole logo visible, never cropped or stretched
  const glyph = await sharp(trimmed)
    .resize(box, box, { fit: 'inside' })
    .toBuffer();

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: bg },
  })
    .composite([{ input: glyph, gravity: 'center' }])
    .png()
    .toFile(outFile);

  return box;
}

(async () => {
  if (!fs.existsSync(INPUT)) throw new Error('Input not found: ' + INPUT);
  if (!fs.existsSync(SPLASH)) throw new Error('Splash image not found: ' + SPLASH);

  if (fs.existsSync(OUTPUT)) fs.copyFileSync(OUTPUT, OUTPUT.replace('.png', '.bak.png'));
  if (fs.existsSync(NORMAL)) fs.copyFileSync(NORMAL, NORMAL.replace('.png', '.bak.png'));

  // 1. background colour
  const bg  = await detectBackground();
  const hex = toHex(bg.r, bg.g, bg.b);

  // 2. flatten onto the background, then trim empty space around the logo
  const flat = await sharp(INPUT)
    .flatten({ background: bg })
    .png()
    .toBuffer();

  let trimmed;
  try {
    trimmed = await sharp(flat)
      .trim({ background: bg, threshold: TRIM_THRESHOLD })
      .png()
      .toBuffer();
  } catch {
    trimmed = flat;
  }

  // 3. build both icons: logo centred on a flat background-colour canvas
  const innerA = await buildIcon(trimmed, bg, GLYPH_ADAPTIVE, OUTPUT);
  const innerN = await buildIcon(trimmed, bg, GLYPH_NORMAL, NORMAL);

  // 4. sync app.json
  const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));

  app.expo.icon = './assets/images/applogo-icon.png';
  app.expo.ios = app.expo.ios || {};
  app.expo.ios.icon = './assets/images/applogo-icon.png';

  app.expo.android = app.expo.android || {};
  app.expo.android.adaptiveIcon = app.expo.android.adaptiveIcon || {};
  app.expo.android.adaptiveIcon.foregroundImage = './assets/images/applogo-adaptive.png';
  app.expo.android.adaptiveIcon.backgroundColor = hex;

  // splash screen (expo-splash-screen plugin)
  app.expo.plugins = app.expo.plugins || [];
  const splashEntry = app.expo.plugins.find(
    (p) => Array.isArray(p) && p[0] === 'expo-splash-screen'
  );
  const splashCfg = {
    image: './assets/images/splashscreenicon.png',
    imageWidth: 150,
    resizeMode: 'contain',
    backgroundColor: SPLASH_BG_LIGHT,
    dark: { backgroundColor: SPLASH_BG_DARK },
  };
  if (splashEntry) {
    splashEntry[1] = { ...(splashEntry[1] || {}), ...splashCfg };
  } else {
    app.expo.plugins.push(['expo-splash-screen', splashCfg]);
  }

  if (process.argv.includes('--bump')) {
    app.expo.android.versionCode = (app.expo.android.versionCode || 1) + 1;
  }
  fs.writeFileSync(APP_JSON, JSON.stringify(app, null, 2) + '\n');

  console.log('OK  Wrote ' + OUTPUT);
  console.log('    adaptive: canvas ' + CANVAS + 'x' + CANVAS + ', logo max ' + innerA + 'px');
  console.log('OK  Wrote ' + NORMAL);
  console.log('    normal:   canvas ' + CANVAS + 'x' + CANVAS + ', logo max ' + innerN + 'px');
  console.log('    background -> ' + hex);
  console.log('    splash     -> ./assets/images/splashscreenicon.png');
  console.log('    splash bg  -> light ' + SPLASH_BG_LIGHT + ', dark ' + SPLASH_BG_DARK);
  console.log('    android.versionCode -> ' + app.expo.android.versionCode);
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });