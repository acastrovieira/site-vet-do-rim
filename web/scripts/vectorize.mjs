import sharp from 'sharp';
import potrace from 'potrace';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function traceLayer(buffer, width, height) {
  // Convert raw buffer back to a PNG buffer first
  const pngBuffer = await sharp(buffer, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  return new Promise((resolve, reject) => {
    const params = {
      turdSize: 5,       // ignore small spots
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

export async function vectorizeTwoColorPng(inputPath, outputPath, colors) {
  console.log(`Vectorizing ${path.basename(inputPath)}...`);
  
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

    // Initialize both as transparent
    blueBuffer[idx] = 0; blueBuffer[idx+1] = 0; blueBuffer[idx+2] = 0; blueBuffer[idx+3] = 0;
    goldBuffer[idx] = 0; goldBuffer[idx+1] = 0; goldBuffer[idx+2] = 0; goldBuffer[idx+3] = 0;

    if (a > 60) {
      // Classify color: if R channel is high, it is Gold; if low, it is Blue.
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

  console.log('Tracing blue layer...');
  const blueSvg = await traceLayer(blueBuffer, width, height);
  
  console.log('Tracing gold layer...');
  const goldSvg = await traceLayer(goldBuffer, width, height);

  const bluePaths = extractPath(blueSvg);
  const goldPaths = extractPath(goldSvg);

  const { viewBox, width: svgW, height: svgH } = getSvgSize(blueSvg);

  const combinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox || `0 0 ${width} ${height}`}" width="${svgW || width}" height="${svgH || height}">
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
  console.log(`✓ Saved vectorized SVG to ${outputPath}`);
}

// Running script directly if launched from CLI
if (process.argv[1] && process.argv[1].endsWith('vectorize.mjs')) {
  const symbolPng = 'C:/Users/acast/.gemini/antigravity-ide/brain/c6dc56a9-9418-45ed-a5d7-ec4c5ed75ede/media__1781930154526.png';
  const symbolSvgOut = 'C:/Users/acast/.gemini/antigravity-ide/brain/c6dc56a9-9418-45ed-a5d7-ec4c5ed75ede/logo-symbol.svg';

  const brandColors = {
    blue: '#0D1B2A',
    gold: '#BFA27E'
  };

  vectorizeTwoColorPng(symbolPng, symbolSvgOut, brandColors)
    .then(() => console.log('Vectorization complete!'))
    .catch(console.error);
}
