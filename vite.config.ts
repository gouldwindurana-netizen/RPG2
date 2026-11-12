import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { readCurrentGame } from './tools/current-game.mjs';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'selected-standalone-game',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (!['GET', 'HEAD'].includes(request.method ?? '') || !['/', '/index.html', '/demo', '/demo/', '/demo/index.html', '/The_Road_Beyond_the_Bells.html'].includes(path)) return next();
        try {
          const { html } = readCurrentGame();
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length, 'Cache-Control': 'no-store' });
          response.end(request.method === 'HEAD' ? undefined : html);
        } catch (error) {
          next(error);
        }
      });
    },
  }, viteSingleFile(), {
    name: 'third-party-notices',
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace('</head>', `<!--\n${readFileSync(new URL('./THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8')}\n-->\n</head>`),
    },
  }],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
