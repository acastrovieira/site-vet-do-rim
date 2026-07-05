import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const logoDir = path.join(ROOT, 'public', 'logo');

async function checkImage(filename) {
  const filePath = path.join(logoDir, filename);
  const { data, info } = await sharp(filePath)
    .raw()
    .toBuffer({ resolveWithObject: true });
    
  let transparentCount = 0;
  let whiteCount = 0;
  let otherCount = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const a = data[i+3];
    
    if (a < 10) {
      transparentCount++;
    } else if (r > 240 && g > 240 && b > 240) {
      whiteCount++;
    } else {
      otherCount++;
    }
  }
  
  console.log(`Image: ${filename}`);
  console.log(`  Total pixels: ${info.width * info.height}`);
  console.log(`  Transparent pixels: ${transparentCount}`);
  console.log(`  White pixels: ${whiteCount}`);
  console.log(`  Other pixels: ${otherCount}`);
}

async function run() {
  await checkImage('logo orig.png');
  await checkImage('Logotipo.png');
}

run().catch(console.error);
