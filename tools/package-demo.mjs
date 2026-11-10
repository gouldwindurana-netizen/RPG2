import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const destination = new URL('../demo/', import.meta.url);
mkdirSync(fileURLToPath(destination), { recursive: true });
copyFileSync(new URL('../dist/index.html', import.meta.url), new URL('index.html', destination));
console.log('Packaged self-contained demo/index.html');
