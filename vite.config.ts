/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Same isolation headers as public/_headers, so dev/preview behave like production
// (multi-threaded WASM needs crossOriginIsolated).
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [svelte()],
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: 'es' },
  // ORT loads its own wasm glue at runtime; pre-bundling it breaks those dynamic imports.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  test: { include: ['tests/**/*.test.ts'] },
})
