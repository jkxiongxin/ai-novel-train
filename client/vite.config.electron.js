import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// 判断是否是 Electron 构建
const isElectron = process.env.BUILD_TARGET === 'electron'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: isElectron ? './' : '/', // Electron 使用相对路径
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: isElectron ? '../desktop/client-dist' : 'dist',
    emptyOutDir: true
  }
})
