import type { Plugin } from 'vite';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const stripCssImportsFromLibrary = (): Plugin => ({
  name: 'strip-css-imports-from-lib',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') {
        file.code = file.code.replaceAll(/import\s*["'][^"']+\.css["'];?\n?/g, '');
      }
    }
  },
});

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    emptyOutDir: false,
    lib: {
      entry: 'src/wod-revised.ts',
      formats: ['es'],
      fileName: () => 'wod-revised.js',
    },
    minify: false,
    outDir: 'dist',
    rollupOptions: {
      output: {
        assetFileNames: ({ names }) => {
          if (names.some(assetName => assetName.endsWith('.css'))) {
            return 'wod-revised.css';
          }

          return 'assets/[name][extname]';
        },
      },
    },
    sourcemap: true,
  },
  plugins: [tailwindcss(), stripCssImportsFromLibrary()],
  publicDir: false,
  resolve: {
    tsconfigPaths: true,
  },
});
