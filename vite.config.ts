import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), {
    name: 'third-party-notices',
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace('</head>', `<!--\n${readFileSync(new URL('./THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8')}\n-->\n</head>`),
    },
  }],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
