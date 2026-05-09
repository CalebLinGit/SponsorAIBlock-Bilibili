import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, cpSync, watch } from 'fs';
import react from '@vitejs/plugin-react';

// Build 1 (default): popup + content + background
// Build 2 (--config vite.inject.config.ts): inject only, IIFE format
// Run both via: npm run build

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: (chunk) => {
          const name = chunk.name.replace(/^_+/, 'vendor-');
          return `chunks/${name}-[hash].js`;
        },
        assetFileNames: '[name].[ext]'
      }
    },
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  },
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      configureServer(server) {
        if (existsSync('src/_locales')) {
          watch('src/_locales', { recursive: true }, (eventType, filename) => {
            if (filename && filename.endsWith('.json')) {
              cpSync('src/_locales', 'dist/_locales', { recursive: true });
              server.ws.send({ type: 'full-reload', path: '*' });
            }
          });
        }
        watch('manifest.json', () => {
          copyFileSync('manifest.json', 'dist/manifest.json');
        });
      },
      closeBundle() {
        if (!existsSync('dist')) mkdirSync('dist', { recursive: true });
        copyFileSync('manifest.json', 'dist/manifest.json');
        if (existsSync('src/icons')) cpSync('src/icons', 'dist/icons', { recursive: true });
        if (existsSync('src/_locales')) cpSync('src/_locales', 'dist/_locales', { recursive: true });
        if (existsSync('src/lib')) cpSync('src/lib', 'dist/lib', { recursive: true });
      }
    }
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  }
});
