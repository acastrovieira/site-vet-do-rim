import sharp from 'sharp';
import potrace from 'potrace';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Helper to trace a single monochrome layer buffer
async function traceLayer(buffer, width, height) {
  const pngBuffer = await sharp(buffer, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  return new Promise((resolve, reject) => {
    const params = {
      turdSize: 8,       // ignore small specs/noises
      alphaMax: 1.0,      // smoothness
      optTolerance: 0.2
    };
    potrace.trace(pngBuffer, params, (err, svg) => {
      if (err) return reject(err);
      resolve(svg);
    });
  });
}

function extractPath(svgContent) {
  const match = svgContent.match(/<path[^>]*d="[^"]+"[^>]*\/>/g);
  if (!match) return '';
  return match.join('\n');
}

function getSvgSize(svgContent) {
  const viewboxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const widthMatch = svgContent.match(/width="([^"]+)"/);
  const heightMatch = svgContent.match(/height="([^"]+)"/);
  return {
    viewBox: viewboxMatch ? viewboxMatch[1] : null,
    width: widthMatch ? widthMatch[1] : null,
    height: heightMatch ? heightMatch[1] : null
  };
}

// 1. Vectorize a Two-Color PNG (Navy + Gold)
async function vectorizeTwoColor(inputPath, outputPath, colors) {
  console.log(`\nVectorizing two-color logo: ${path.basename(inputPath)}...`);
  
  const { data, info } = await sharp(inputPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const total = width * height;

  const blueBuffer = Buffer.alloc(total * 4);
  const goldBuffer = Buffer.alloc(total * 4);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    // Default: white background for potrace
    blueBuffer[idx] = 255; blueBuffer[idx+1] = 255; blueBuffer[idx+2] = 255; blueBuffer[idx+3] = 255;
    goldBuffer[idx] = 255; goldBuffer[idx+1] = 255; goldBuffer[idx+2] = 255; goldBuffer[idx+3] = 255;

    if (a > 30) {
      // If red channel is high, it's Gold; if low, it's Navy Blue
      // Gold is around rgb(191,157,90) - red is high. Navy is around rgb(13,41,73) - red is very low.
      const isGold = r > 100;
      
      if (isGold) {
        goldBuffer[idx] = 0;
        goldBuffer[idx + 1] = 0;
        goldBuffer[idx + 2] = 0;
        goldBuffer[idx + 3] = 255;
      } else {
        blueBuffer[idx] = 0;
        blueBuffer[idx + 1] = 0;
        blueBuffer[idx + 2] = 0;
        blueBuffer[idx + 3] = 255;
      }
    }
  }

  const blueSvg = await traceLayer(blueBuffer, width, height);
  const goldSvg = await traceLayer(goldBuffer, width, height);

  const bluePaths = extractPath(blueSvg);
  const goldPaths = extractPath(goldSvg);

  const { viewBox } = getSvgSize(blueSvg);

  const combinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox || `0 0 ${width} ${height}`}" width="100%" height="100%">
  <!-- Navy Blue Layer -->
  <g fill="${colors.blue}">
    ${bluePaths}
  </g>
  <!-- Gold Layer -->
  <g fill="${colors.gold}">
    ${goldPaths}
  </g>
</svg>`;

  await fs.writeFile(outputPath, combinedSvg);
  console.log(`✓ Saved two-color SVG to ${outputPath}`);
}

// 2. Vectorize a Monochromatic PNG using alpha-masking
async function vectorizeMonochromatic(inputPath, outputPath, fillColor) {
  console.log(`\nVectorizing monochromatic logo: ${path.basename(inputPath)}...`);
  
  const { data, info } = await sharp(inputPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const total = width * height;

  const bAndWBuffer = Buffer.alloc(total * 4);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const a = data[idx + 3];

    // threshold at 30 to get clean edges of the shape
    if (a > 30) {
      bAndWBuffer[idx] = 0;
      bAndWBuffer[idx + 1] = 0;
      bAndWBuffer[idx + 2] = 0;
      bAndWBuffer[idx + 3] = 255; // solid black shape
    } else {
      bAndWBuffer[idx] = 255;
      bAndWBuffer[idx + 1] = 255;
      bAndWBuffer[idx + 2] = 255;
      bAndWBuffer[idx + 3] = 255; // solid white background
    }
  }

  const pngBuffer = await sharp(bAndWBuffer, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  return new Promise((resolve, reject) => {
    const params = {
      turdSize: 8,
      alphaMax: 1.0,
      optTolerance: 0.2
    };
    
    potrace.trace(pngBuffer, params, async (err, svgContent) => {
      if (err) return reject(err);

      const cleanPaths = extractPath(svgContent);
      const { viewBox } = getSvgSize(svgContent);

      const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox || `0 0 ${width} ${height}`}" width="100%" height="100%">
  <g fill="${fillColor}">
    ${cleanPaths}
  </g>
</svg>`;

      try {
        await fs.writeFile(outputPath, finalSvg);
        console.log(`✓ Saved monochromatic SVG to ${outputPath}`);
        resolve();
      } catch (writeErr) {
        reject(writeErr);
      }
    });
  });
}

async function run() {
  const brandColors = {
    blue: '#0D1B2A', // Brand Navy
    gold: '#BFA27E', // Brand Gold
    white: '#FFFFFF'
  };

  const logoDir = path.join(ROOT, 'public', 'logo');
  const outDir = path.join(ROOT, 'public');

  // Input file paths
  const verticalOrigPng = path.join(logoDir, 'logo orig.png');
  const verticalGoldPng = path.join(logoDir, 'Monocromática - Dourada.png');
  const verticalNavyPng = path.join(logoDir, 'Monocromática - Azul-Marinho.png');
  const verticalWhitePng = path.join(logoDir, 'Monocromática - Fundo Escuro.png');

  const horizontalOrigPng = path.join(logoDir, 'Logotipo.png');
  const horizontalGoldPng = path.join(logoDir, 'Monocromática - Branca (2).png'); // This has gold color in Canva's upload
  const horizontalNavyPng = path.join(logoDir, 'Monocromática - Azul Escuro (fundo claro).png');
  const horizontalWhitePng = path.join(logoDir, 'Monocromática - Branca.png');

  // Vectorize Vertical variations
  await vectorizeTwoColor(verticalOrigPng, path.join(outDir, 'logo-vertical.svg'), brandColors);
  await vectorizeMonochromatic(verticalGoldPng, path.join(outDir, 'logo-vertical-gold.svg'), brandColors.gold);
  await vectorizeMonochromatic(verticalNavyPng, path.join(outDir, 'logo-vertical-navy.svg'), brandColors.blue);
  await vectorizeMonochromatic(verticalWhitePng, path.join(outDir, 'logo-vertical-white.svg'), brandColors.white);

  // Vectorize Horizontal variations
  await vectorizeTwoColor(horizontalOrigPng, path.join(outDir, 'logo-horizontal.svg'), brandColors);
  await vectorizeMonochromatic(horizontalGoldPng, path.join(outDir, 'logo-horizontal-gold.svg'), brandColors.gold);
  await vectorizeMonochromatic(horizontalNavyPng, path.join(outDir, 'logo-horizontal-navy.svg'), brandColors.blue);
  await vectorizeMonochromatic(horizontalWhitePng, path.join(outDir, 'logo-horizontal-white.svg'), brandColors.white);

  // Generate Watermark / Marca D'água (Semi-transparent logo symbol)
  console.log('\nGenerating watermark and decorative assets...');
  
  // Vectorize the gold symbol from public/logo/5.png for the watermark
  const symbolOrigPng = path.join(logoDir, '5.png'); // Gold symbol
  const symbolSvgPath = path.join(outDir, 'logo.svg');
  await vectorizeMonochromatic(symbolOrigPng, symbolSvgPath, brandColors.gold);
  
  const symbolContent = await fs.readFile(symbolSvgPath, 'utf8');
  
  // Create a watermark SVG by setting opacity on the group
  const watermarkContent = symbolContent.replace('<svg ', '<svg opacity="0.05" ');
  await fs.writeFile(path.join(outDir, 'watermark.svg'), watermarkContent);
  console.log('✓ Generated public/watermark.svg');

  console.log('\n✅ All logo vectorizations completed successfully!');
}

run().catch(console.error);
