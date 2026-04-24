import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      // 后端跑起来后通过 .env.local 或环境变量 VITE_API_TARGET 指向真实地址
      //   VITE_API_TARGET=http://127.0.0.1:3001 pnpm dev
      // 默认指向一个不存在端口，让请求立即失败，前端走 mock 兜底
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
