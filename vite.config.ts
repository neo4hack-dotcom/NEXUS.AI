import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  base: './',
  build: {
    // Route views are already code-split via React.lazy in App.tsx. Here we
    // additionally peel the heavy third-party libraries into their own stable,
    // long-cacheable vendor chunks so an app-code change doesn't bust them.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // exceljs (+ its transitive deps) is the single biggest dependency and
          // is only needed for spreadsheet export — keep it fully isolated so it
          // is fetched lazily alongside the export code path, never on first paint.
          if (id.includes('exceljs') || id.includes('/jszip') || id.includes('/archiver')) {
            return 'vendor-exceljs';
          }
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          return 'vendor';
        },
      },
    },
    // The vendor-exceljs chunk (~940 kB) is intrinsically large but loads on
    // demand only (spreadsheet export path), never on first paint.
    chunkSizeWarningLimit: 1000,
  },
});
