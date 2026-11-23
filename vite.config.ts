/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  worker: { format: 'es' },
  // ORT loads its own wasm glue at runtime; pre-bundling it breaks those dynamic imports.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  test: { include: ['tests/**/*.test.ts'] },
})
