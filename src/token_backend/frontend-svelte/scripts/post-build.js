import { copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Ensure .well-known directory exists in dist
mkdirSync(join(projectRoot, 'dist', '.well-known'), { recursive: true });

// Copy .well-known files
copyFileSync(
  join(projectRoot, 'public', '.well-known', 'ic-domains'),
  join(projectRoot, 'dist', '.well-known', 'ic-domains')
);

copyFileSync(
  join(projectRoot, 'public', '.well-known', 'ii-alternative-origins'),
  join(projectRoot, 'dist', '.well-known', 'ii-alternative-origins')
);

// Copy .ic-assets.json5
copyFileSync(
  join(projectRoot, 'public', '.ic-assets.json5'),
  join(projectRoot, 'dist', '.ic-assets.json5')
);

console.log('Build files copied successfully!'); 
