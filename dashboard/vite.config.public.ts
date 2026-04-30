import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Force the public-mode flag so Vite picks it up via import.meta.env.VITE_PUBLIC_MODE
// (works for both `vite` dev-server and `vite build`; `define` alone only works at build time)
process.env.VITE_PUBLIC_MODE = 'true';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3008',
      '/ws': { target: 'ws://localhost:3008', ws: true },
    },
  },
  build: {
    outDir: 'dist-public',
  },
});
