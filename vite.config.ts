import {defineConfig} from 'vite';

export default defineConfig(({mode}) => ({
  base: './',
  define: {__CONTENT_SERVER__: JSON.stringify(process.env.LOVEHOUSE_CONTENT_SERVER || (mode === 'e2e' ? '' : 'https://server.080726.xyz/lovehouse/')), __BUILD_INFO__: JSON.stringify({version: process.env.LOVEHOUSE_BUILD_VERSION || process.env.GITHUB_SHA?.slice(0, 12) || process.env.npm_package_version || 'dev', builtAt: new Date().toISOString()})},
  resolve: {preserveSymlinks: true},
  build: {
    outDir: mode === 'e2e' ? 'dist-e2e' : 'dist',
    rollupOptions: {output: {manualChunks: {phaser: ['phaser']}}},
  },
}));
