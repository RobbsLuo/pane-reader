import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// content script 构建：必须打成单文件 IIFE（不支持 ESM 入口）
export default defineConfig({
  publicDir: false,
  // 全部转义为非 ASCII，避免输出字面量 U+FFFF 等非字符导致 Chrome 拒绝加载
  esbuild: { charset: 'ascii' },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome120',
    cssCodeSplit: false,
    // 字体等资源全部内联，避免 content script 里出现相对路径
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    lib: {
      entry: resolve(process.cwd(), 'src/content.ts'),
      formats: ['iife'],
      name: 'MarkdownReader',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
})
