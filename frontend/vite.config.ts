import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'lucide-react', 'qrcode.react', 'jsqr', 'clsx'],
  },
  server: {
    port: 5174,
    watch: {
      ignored: [
        '**/*.tsbuildinfo',
        '**/tsconfig.tsbuildinfo',
        '**/dist/**',
        '**/.git/**',
        '**/target/**',
      ],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8085',
        changeOrigin: true,
      },
    },
  },
});
