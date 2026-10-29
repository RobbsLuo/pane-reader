import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// 页面构建（popup 等），产物为 ESM
export default defineConfig({
  publicDir: 'public',
  esbuild: { charset: 'ascii' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
    rollupOptions: {
      input: { popup: resolve(process.cwd(), 'popup.html') },
    },
  },
})
