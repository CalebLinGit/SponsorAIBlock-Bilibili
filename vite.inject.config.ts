import { defineConfig } from 'vite';
import { resolve } from 'path';

// Builds inject.ts as a self-contained IIFE — no shared chunks, no import statements.
// Injected into the page as a plain <script> tag so it cannot use ES module syntax.

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,   // don't wipe dist from the main build
    lib: {
      entry: resolve(__dirname, 'src/inject.ts'),
      name: 'SAI',
      fileName: () => 'inject.js',
      formats: ['iife'],
    },
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  },
});
