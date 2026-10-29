import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Mermaid 渲染器：独立扩展页面（有 DOM、不受宿主页 CSP 限制），
// content script 通过隐藏 iframe + postMessage 调用，主脚本不必内联 4.6MB。
export default defineConfig({
  base: './',
  publicDir: false,
  esbuild: { charset: 'ascii' },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome120',
    rollupOptions: {
      input: { 'mermaid-frame': resolve(process.cwd(), 'mermaid-frame.html') },
      output: {
        entryFileNames: 'mermaid-frame.js',
        chunkFileNames: 'mermaid-frame-[name].js',
        assetFileNames: 'mermaid-frame.[ext]',
      },
    },
  },
})
