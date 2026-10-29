import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// service worker：单文件 IIFE
export default defineConfig({
  publicDir: false,
  esbuild: { charset: 'ascii' },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome120',
    lib: {
      entry: resolve(process.cwd(), 'src/background.ts'),
      formats: ['iife'],
      name: 'MarkdownReaderBackground',
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
})
