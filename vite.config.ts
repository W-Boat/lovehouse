import {defineConfig} from 'vite';
export default defineConfig({base:'./',resolve:{preserveSymlinks:true},build:{rollupOptions:{output:{manualChunks:{phaser:['phaser']}}}}});
