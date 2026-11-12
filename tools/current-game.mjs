import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The selected upload remains authoritative in this workspace. The packaged
// copy keeps the checkout playable when it is used outside this workspace.
const selectedGame = new URL('../../active-game/The_Road_Beyond_the_Bells.html', import.meta.url);
const packagedGame = new URL('../demo/index.html', import.meta.url);

export function readCurrentGame() {
  const source = existsSync(selectedGame) ? selectedGame : packagedGame;
  return { source: fileURLToPath(source), html: readFileSync(source) };
}
