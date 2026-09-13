import path from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

export default defineConfig({
  root,
  resolve: {
    alias: {
      '@': path.resolve(root, '../src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    // Linux may resolve localhost to IPv6 only. Serve both documented browser
    // URLs via IPv4 loopback without exposing the preview to the network.
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(root, 'dist'),
    emptyOutDir: true,
  },
});
