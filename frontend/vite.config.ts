import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Ảnh bìa sách được backend lưu và phục vụ trực tiếp tại /static/covers/...
      '/static': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
      // WebSocket thông báo realtime cho admin (routers/notifications.py).
      '/ws': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
