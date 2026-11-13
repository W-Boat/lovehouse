import {defineConfig} from 'vite';

export default defineConfig(({mode}) => ({
  base: './',
  resolve: {preserveSymlinks: true},
  build: {
    outDir: mode === 'e2e' ? 'dist-e2e' : 'dist',
    rollupOptions: {output: {manualChunks: {phaser: ['phaser']}}},
  },
}));
