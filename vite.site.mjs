import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const local = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: local('./src/site'),
  base: './',
  build: {
    outDir: local('./dist/site'),
    emptyOutDir: true,
    rolldownOptions: {
      input: [local('./src/site/index.html'), local('./src/site/privacy.html')],
    },
  },
});
