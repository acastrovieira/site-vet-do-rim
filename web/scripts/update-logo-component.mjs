import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

async function main() {
  const svgPath = 'C:/Users/acast/.gemini/antigravity-ide/brain/c6dc56a9-9418-45ed-a5d7-ec4c5ed75ede/logo-symbol.svg';
  const logoComponentPath = path.join(ROOT, 'src', 'components', 'ui', 'VetDoRimLogo.tsx');

  console.log(`Reading vectorized SVG from: ${svgPath}`);
  const svgContent = await fs.readFile(svgPath, 'utf8');

  // Extract the d attributes from the paths
  // First group: Navy Blue Group, Second group: Gold Group
  const matches = [...svgContent.matchAll(/d="([^"]+)"/g)];
  if (matches.length < 2) {
    throw new Error('Could not find both paths in the SVG!');
  }

  const navyPath = matches[0][1];
  const goldPath = matches[1][1];

  console.log('Successfully extracted paths!');
  console.log(`Reading component: ${logoComponentPath}`);
  let componentContent = await fs.readFile(logoComponentPath, 'utf8');

  // 1. Remove defs block (lines 77 to 99 approx)
  const defsRegex = /<defs>[\s\S]*?<\/defs>\s*/;
  componentContent = componentContent.replace(defsRegex, '');

  // 2. Locate the group with id="simbolo" and replace its contents
  // The old code is:
  // <g
  //   id="simbolo"
  //   transform={isHorizontal ? 'translate(150, 125)' : 'translate(400, 180)'}
  // >
  //   ... old paths ...
  // </g>
  // We want to replace everything inside <g id="simbolo" ...> ... </g> with:
  // <g transform="scale(0.22) translate(-524.5, -556)">
  //   <path className={`${kidneyColor} transition-colors duration-500`} d="navyPath" />
  //   <path className="fill-[#BFA27E] transition-colors duration-500" d="goldPath" />
  // </g>

  const oldSimboloGroupRegex = /(<g\s+id="simbolo"\s+transform=\{[^\}]+\}\s*>)[\s\S]*?(<\/g>)/;
  
  const replacementContent = `$1
        {/* Wrapper to scale and center the new 1024x1024 symbol */}
        <g transform="scale(0.22) translate(-524.5, -556)">
          {/* Rim e silhuetas recortadas (Azul Noturno / Branco) */}
          <path
            className={\`\${kidneyColor} transition-colors duration-500\`}
            d="${navyPath}"
          />
          {/* Ureteres e Curvas (Dourado) */}
          <path
            className="fill-[#BFA27E] transition-colors duration-500"
            d="${goldPath}"
          />
        </g>
      $2`;

  componentContent = componentContent.replace(oldSimboloGroupRegex, replacementContent);

  // 3. Save the modified component file
  await fs.writeFile(logoComponentPath, componentContent, 'utf8');
  console.log('✓ Successfully updated VetDoRimLogo.tsx component!');
}

main().catch(console.error);
