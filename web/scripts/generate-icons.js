const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, '../public/logo.svg');
const publicDir = path.join(__dirname, '../public');

async function generateIcons() {
  if (!fs.existsSync(svgPath)) {
    console.error('logo.svg not found at', svgPath);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Generating icons from logo.svg...');

  // 1. favicon.png (32x32)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Created favicon.png (32x32)');

  // 2. apple-touch-icon.png (180x180)
  // Usually this has a white/solid background, but we can keep it transparent
  // or add a background. We'll stick to what sharp outputs for SVG (transparent).
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png (180x180)');

  // 3. icon-192.png
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Created icon-192.png (192x192)');

  // 4. icon-512.png
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Created icon-512.png (512x512)');

  // Do not overwrite favicon.ico with renamed PNG bytes. Use
  // generate-favicon.mjs when a native multi-size ICO must be regenerated.
  console.log('Kept existing favicon.ico unchanged');

  console.log('Done!');
}

generateIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
