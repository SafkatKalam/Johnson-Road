import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // 127.0.0.1 = this computer only. Without it Node listens on IPv6 only ([::1]) and some browsers
    // cannot open the page; "localhost" falls back to IPv4 by itself.
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    open: true,
  },
});
