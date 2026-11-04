@'
const sharp = require('sharp');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const INPUT = path.join(ROOT, 'assets', 'images', 'applogo.png');
const OUTPUT = path.join(ROOT, 'assets', 'images', 'applogo-adaptive.png');
const SCALE = 0.6;

(async () => {
  if (!require('fs').existsSync(INPUT)) throw new Error('Input not found: ' + INPUT);

  const buf = await sharp(INPUT).ensureAlpha().trim({ threshold: 1 }).toBuffer();
  const meta = await sharp(buf).metadata();
  const size = Math.max(meta.width, meta.height);
  const inner = Math.round(size * SCALE);
  const offset = Math.round((size - inner) / 2);

  const logo = await sharp(buf)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, top: offset, left: offset }])
    .png().toFile(OUTPUT);

  console.log('OK  Wrote ' + OUTPUT);
  console.log('    canvas ' + size + 'x' + size + ', logo ' + inner + 'px (60%), pad ' + offset + 'px/side');
})().catch(err => { console.error('ERROR: ' + err.message); process.exit(1); });
'@ | Set-Content -Path src\scripts\pad-icon.js -Encoding ascii 