import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readCurrentGame } from './current-game.mjs';

const { source, html } = readCurrentGame();
const scripts = [...html.toString('utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
if (!scripts.length) throw new Error(`No embedded game script in ${source}`);
for (const [, script] of scripts) {
  const checked = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: script, encoding: 'utf8' });
  if (checked.error) throw checked.error;
  if (checked.status !== 0) throw new Error(checked.stderr || 'Embedded JavaScript syntax check failed');
}
for (const directory of ['dist', 'demo']) {
  const destination = new URL(`../${directory}/`, import.meta.url);
  mkdirSync(destination, { recursive: true });
  writeFileSync(new URL('index.html', destination), html);
}
console.log(JSON.stringify({ source, bytes: html.length, sha256: createHash('sha256').update(html).digest('hex'), outputs: ['dist/index.html', 'demo/index.html'] }, null, 2));
