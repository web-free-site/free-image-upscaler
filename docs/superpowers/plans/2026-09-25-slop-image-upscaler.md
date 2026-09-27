# slop-image-upscaler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A client-side image upscaler (Real-ESRGAN via onnxruntime-web) in the slop app family, with a synced split/side-by-side compare view and PNG/JPEG/WebP export.

**Architecture:** Svelte 5 SPA; a module Web Worker downloads + caches an ONNX model, creates an ORT session (WebGPU → WASM fallback), and upscales the image tile by tile (reflect-padded tiles, cropped on paste). Pure logic (tiling, pixel conversion, limits, model cache, file naming) is unit tested with vitest; ORT and canvas code is verified manually in the browser. Static deploy to Cloudflare Workers with COOP/COEP headers.

**Tech Stack:** Svelte 5 (no SvelteKit), Vite 8, TypeScript, vitest, onnxruntime-web, pica, @lucide/svelte, wrangler. Python (uv) for one-off model export.

**Spec:** `docs/superpowers/specs/2026-09-25-slop-image-upscaler-design.md`

**Reference app:** `../slop-vectorizer` (sibling directory). Several files are copied from it verbatim; paths below are relative to this repo root.

## Global Constraints

- Everything runs in the browser; no image leaves the device. No server code.
- Styling: scoped CSS + tokens from slop-vectorizer `src/app.css`; dark only; no Tailwind.
- Models: fp32 ONNX, NCHW float32 RGB in [0,1], ×4 output, input name/output name read from the session (`session.inputNames[0]`, `session.outputNames[0]`).
- Model licenses: Real-ESRGAN BSD-3 — README must credit it.
- ORT `.wasm` loaded from jsDelivr pinned to the installed package version; no ORT `.wasm` file over 25 MiB may end up in the deployed assets.
- Tile core 512 px on WebGPU, 256 px on WASM; pad 16 px, reflect at image edges; crop `pad × outScale` on paste.
- Output longest side ≤ 8192 px. Output area ≤ 8192² on desktop, ≤ 16,777,216 px on iPhone/iPad (Safari canvas limit; refines the spec's "within Safari canvas limits").
- ×2 output = ×4 model output, Lanczos-downscaled with pica **per tile** before paste (bounds memory by final output; refines spec's whole-image downscale).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Transparent PNG input** — alpha must survive the upscale (models are RGB-only), and JPEG export must flatten on white, not black. Tests: Task 4 (`upscaleImage` alpha test), Task 9 (manual JPEG check listed in QA).
2. **Tiny images (1×1, 3×5) smaller than the 16 px pad** — reflect padding must not index out of bounds. Test: Task 4 (`reflect`, `extractTile` 1×1 and round trip on 3×5).
3. **Safari without WebP encoding** — `convertToBlob({type:'image/webp'})` silently returns PNG; the saved file must get the `.png` extension and the user a notice. Test: Task 9 (`exportName` keyed by actual blob type).
4. **Cancel, then immediately re-run** — progress/result from the killed job must not reach the UI. Test: Task 7 (`UpscalerClient` stale/cancel tests).
5. **Interrupted model download** — a partial model must not be written to the cache (next load would crash ORT forever). Test: Task 6 (`loadModel` stream-error test).

---

## File Structure

```
package.json, vite.config.ts, tsconfig*.json, svelte.config.js, eslint.config.js,
.prettierrc, .prettierignore, .gitignore, index.html, wrangler.jsonc   — project config
public/_headers            — COOP/COEP for Cloudflare
public/favicon.svg
public/models/*.onnx       — self-exported general-x4v3 + anime_6B (committed)
tools/export_onnx.py       — Real-ESRGAN .pth → ONNX export + validation (uv script)
src/main.ts, src/app.css   — copied from vectorizer
src/types.ts               — RasterImage, ModelId, Ep, worker message types
src/App.svelte             — state, layout, run/cancel/save orchestration, dialogs
src/lib/models.ts          — model registry
src/lib/modelCache.ts      — fetch-with-progress + Cache Storage
src/lib/limits.ts          — output size caps, fit-input computation
src/lib/decode.ts          — file → RasterImage (alpha kept), canvas resize
src/lib/exportImage.ts     — encode RasterImage → Blob, export filename
src/lib/saveFile.ts, src/lib/share.ts   — save picker / share sheet / download (adapted from vectorizer)
src/lib/sliderFill.ts, src/lib/viewport.svelte.ts, src/lib/viewportMath.ts — copied from vectorizer
src/lib/CompareView.svelte, src/lib/ImagePane.svelte — adapted from vectorizer
src/lib/Dropzone.svelte    — adapted from vectorizer
src/lib/ControlsPanel.svelte — new sidebar
src/lib/workerClient.ts    — UpscalerClient (jobs, stale drop, cancel)
src/worker/tiling.ts       — planTiles, reflect, extractTile, pasteTile
src/worker/pixels.ts       — planar RGB conversion, alpha helpers, bilinear channel resize
src/worker/upscaleCore.ts  — upscaleImage(): tile loop, injected run/resize
src/worker/session.ts      — ORT env + session creation with EP fallback + runTile
src/worker/upscale.worker.ts — message handling; wires cache, session, pica, core
tests/*.test.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.tests.json`, `svelte.config.js`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `index.html`, `wrangler.jsonc`, `public/_headers`, `public/favicon.svg`, `src/main.ts`, `src/app.css`, `src/App.svelte`, `src/types.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `RasterImage { width: number; height: number; data: Uint8ClampedArray }` in `src/types.ts`; npm scripts `dev`, `build`, `preview`, `test`, `check`, `lint`, `format`, `deploy`.

- [ ] **Step 1: Copy unchanged config/style files from the vectorizer**

```bash
V=../slop-vectorizer
cp $V/tsconfig.json $V/tsconfig.app.json $V/tsconfig.node.json $V/tsconfig.tests.json \
   $V/svelte.config.js $V/.prettierrc $V/.prettierignore $V/.gitignore .
mkdir -p src tests public tools
cp $V/src/main.ts $V/src/app.css src/
cp $V/eslint.config.js .
```

Edit `eslint.config.js`: replace the `tools/**/*.mjs` block (icon generator, not present here) — delete that whole object. Keep the rest.

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "slop-image-upscaler",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "description": "Client-side AI image upscaler (Real-ESRGAN) — nothing uploaded",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "svelte-check --tsconfig ./tsconfig.app.json && tsc -p tsconfig.node.json && tsc -p tsconfig.tests.json",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "deploy": "npm run build && wrangler deploy"
  }
}
```

Then install (versions resolve to current latest):

```bash
npm install onnxruntime-web pica @lucide/svelte
npm install -D svelte @sveltejs/vite-plugin-svelte vite vitest typescript@~6.0.2 \
  @tsconfig/svelte @types/node svelte-check eslint @eslint/js typescript-eslint \
  eslint-config-prettier prettier prettier-plugin-svelte wrangler
```

If `npm run check` later reports pica has no types, also `npm install -D @types/pica`.

- [ ] **Step 3: Write `vite.config.ts`**

```ts
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
```

- [ ] **Step 4: Write `wrangler.jsonc`, `public/_headers`, `public/favicon.svg`, `index.html`**

`wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "slop-image-upscaler",
  "compatibility_date": "2026-09-01",
  "assets": { "directory": "./dist" },
}
```

`public/_headers`:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

`public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#5b8cff"/><path d="M8 24V14h4v10zm6 0V10h4v14zm6 0V6h4v18z" fill="#121212"/></svg>
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>slop-image-upscaler — AI image upscaling in your browser</title>
    <meta
      name="description"
      content="Free client-side image upscaler: Real-ESRGAN ×2/×4 for photos and anime, running on your GPU in the browser. Nothing uploaded."
    />
    <meta name="theme-color" content="#101013" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `src/types.ts` and a placeholder `src/App.svelte`**

`src/types.ts`:
```ts
export interface RasterImage {
  width: number
  height: number
  data: Uint8ClampedArray // RGBA, length = width*height*4
}
```

`src/App.svelte`:
```svelte
<main class="empty"><h1>slop-image-upscaler</h1></main>

<style>
  .empty {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
```

- [ ] **Step 6: Write the smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { RasterImage } from '../src/types'

describe('smoke', () => {
  it('runs vitest with TS', () => {
    const img: RasterImage = { width: 1, height: 1, data: new Uint8ClampedArray(4) }
    expect(img.data.length).toBe(4)
  })
})
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run check && npm run lint && npm run build`
Expected: 1 test passes; check/lint clean; `dist/` contains `index.html`, `_headers`, `favicon.svg`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold slop-image-upscaler (Svelte 5 + Vite, vectorizer config/tokens)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Model export and validation

**Files:**
- Create: `tools/export_onnx.py`, `public/models/realesr-general-x4v3.onnx`, `public/models/realesrgan-x4plus-anime-6b.onnx`
- Modify: `.gitignore` (already ignores `temp/`; weights are cached there)

**Interfaces:**
- Produces: two ONNX files with input `input` `[1,3,h,w]` and output `output` `[1,3,4h,4w]`, float32 in [0,1]; a validation verdict for `SceneWorks/real-esrgan-onnx` `real_esrgan_x4.onnx` (used by Task 6's registry).

- [ ] **Step 1: Write `tools/export_onnx.py`**

```python
# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["torch==2.8.*", "spandrel", "onnx", "onnxruntime", "numpy"]
# ///
"""Export Real-ESRGAN weights (BSD-3, xinntao/Real-ESRGAN) to ONNX and validate against PyTorch.

  uv run tools/export_onnx.py export          # writes public/models/*.onnx
  uv run tools/export_onnx.py check PATH      # validate a third-party x4plus ONNX

spandrel builds the right architecture (SRVGGNetCompact / RRDBNet) from the .pth, so
basicsr (incompatible with current torchvision) is not needed.
"""
import pathlib
import sys
import urllib.request

import numpy as np
import onnxruntime as ort
import torch
from spandrel import ModelLoader

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "temp" / "weights"
OUT = ROOT / "public" / "models"
WEIGHTS = {
    "realesr-general-x4v3": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth",
    "realesrgan-x4plus-anime-6b": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth",
    "realesrgan-x4plus": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
}
EXPORT = ["realesr-general-x4v3", "realesrgan-x4plus-anime-6b"]


def load(name: str) -> torch.nn.Module:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{name}.pth"
    if not path.exists():
        urllib.request.urlretrieve(WEIGHTS[name], path)
    desc = ModelLoader().load_from_file(str(path))
    assert desc.scale == 4, f"{name}: scale {desc.scale}"
    return desc.model.eval()


def validate(model: torch.nn.Module, onnx_path: pathlib.Path) -> None:
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0]
    print(f"  input {inp.name} {inp.shape}, output {sess.get_outputs()[0].shape}")
    for h, w in [(64, 64), (48, 80)]:
        x = torch.rand(1, 3, h, w)
        with torch.no_grad():
            ref = model(x).numpy()
        got = sess.run(None, {inp.name: x.numpy()})[0]
        assert got.shape == ref.shape, f"shape {got.shape} != {ref.shape}"
        diff = float(np.abs(got - ref).max())
        assert diff < 1e-3, f"{onnx_path.name} {h}x{w}: max diff {diff}"
        print(f"  {onnx_path.name} {h}x{w}: max diff {diff:.2e} OK")


def export(name: str) -> None:
    model = load(name)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{name}.onnx"
    torch.onnx.export(
        model,
        torch.rand(1, 3, 64, 64),
        str(out),
        opset_version=17,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {2: "h", 3: "w"}, "output": {2: "h4", 3: "w4"}},
        dynamo=False,
    )
    validate(model, out)
    print(f"{out.name}: {out.stat().st_size} bytes")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "export":
        for n in EXPORT:
            export(n)
    elif cmd == "check" and len(sys.argv) == 3:
        validate(load("realesrgan-x4plus"), pathlib.Path(sys.argv[2]))
    else:
        sys.exit(__doc__)
```

- [ ] **Step 2: Export and validate**

Run: `uv run tools/export_onnx.py export`
Expected: for each model two `max diff … OK` lines and a byte size (≈4.6 MB general, ≈18 MB anime). Write down both byte sizes — Task 6 uses them.

- [ ] **Step 3: Validate the third-party x4plus ONNX**

```bash
curl -sL https://huggingface.co/api/models/SceneWorks/real-esrgan-onnx | python3 -c 'import sys,json;print(json.load(sys.stdin)["sha"])'
curl -L -o temp/real_esrgan_x4.onnx https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/real_esrgan_x4.onnx
uv run tools/export_onnx.py check temp/real_esrgan_x4.onnx
```

Expected (pass): input shape has symbolic H/W (strings, not numbers), both sizes `OK`. Record the commit sha from the first command — Task 6 pins the URL to it.
If it FAILS (shape mismatch, fixed dims, diff ≥ 1e-3): add `"realesrgan-x4plus"` to `EXPORT`, re-run export, then **stop and ask the user** where to host the 67 MB file (their own Hugging Face repo or a Cloudflare R2 bucket — both are outward-facing actions needing their account). Do not commit a >25 MiB file into `public/models/`.

- [ ] **Step 4: Commit**

```bash
git add tools/export_onnx.py public/models/*.onnx
git commit -m "feat: export Real-ESRGAN general-x4v3 and anime_6B to ONNX

Validated against PyTorch (max abs diff < 1e-3) on 64x64 and 48x80 inputs.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ORT session + isolation/COEP verification (risk spike)

Resolves the spec's top risk before building on it. `session.ts` is kept; the spike page is deleted at the end.

**Files:**
- Create: `src/worker/session.ts` (kept), `spike.html`, `src/spike.ts`, `src/worker/spike.worker.ts` (all three deleted in Step 6)
- Modify (possibly): `public/_headers`, `vite.config.ts`, `docs/superpowers/specs/2026-09-25-slop-image-upscaler-design.md` (append verification log)
- Create (possibly): `public/.assetsignore`

**Interfaces:**
- Produces (in `src/worker/session.ts`):
  - `type Ep = 'webgpu' | 'wasm'` — also re-exported from `src/types.ts`
  - `createSession(model: Uint8Array, forceWasm: boolean): Promise<{ session: ort.InferenceSession; ep: Ep }>`
  - `runTile(session: ort.InferenceSession, input: Float32Array, w: number, h: number): Promise<Float32Array>` — input planar RGB `[1,3,h,w]`, returns planar `[1,3,4h,4w]` clamped to [0,1]

- [ ] **Step 1: Confirm the ORT WebGPU entry point**

Run: `node -e "console.log(Object.keys(require('./node_modules/onnxruntime-web/package.json').exports))"`
Expected: includes `./webgpu`. If not, and the root export documents WebGPU support, import from `onnxruntime-web` instead in Step 2.

- [ ] **Step 2: Write `src/worker/session.ts`**

```ts
import * as ort from 'onnxruntime-web/webgpu'
import type { Ep } from '../types'

// The WebGPU .wasm (~28 MB) is over Cloudflare's 25 MiB per-asset limit, so all ORT binaries
// come from jsDelivr, pinned to the exact version bundled here.
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`
// Threads need SharedArrayBuffer, i.e. a cross-origin-isolated page (public/_headers).
ort.env.wasm.numThreads = self.crossOriginIsolated
  ? Math.min(8, navigator.hardwareConcurrency || 4)
  : 1

export async function createSession(
  model: Uint8Array,
  forceWasm: boolean,
): Promise<{ session: ort.InferenceSession; ep: Ep }> {
  if (!forceWasm && 'gpu' in navigator) {
    try {
      const session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'] })
      return { session, ep: 'webgpu' }
    } catch (err) {
      console.warn('[upscaler] WebGPU session failed, falling back to WASM', err)
    }
  }
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] })
  return { session, ep: 'wasm' }
}

export async function runTile(
  session: ort.InferenceSession,
  input: Float32Array,
  w: number,
  h: number,
): Promise<Float32Array> {
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, h, w]) }
  const out = (await session.run(feeds))[session.outputNames[0]]
  const data = out.data as Float32Array
  for (let i = 0; i < data.length; i++) data[i] = Math.min(1, Math.max(0, data[i]))
  out.dispose()
  return data
}
```

Note: if `out.dispose()` frees `data` on the WebGPU path, copy first: `const data = Float32Array.from(out.data as Float32Array)`. Step 4 detects this (all-zero output).

Add to `src/types.ts`:
```ts
export type Ep = 'webgpu' | 'wasm'
```

- [ ] **Step 3: Write the spike page**

`spike.html` (repo root):
```html
<!doctype html>
<html><body><pre id="out">running…</pre><script type="module" src="/src/spike.ts"></script></body></html>
```

`src/spike.ts`:
```ts
const out = document.getElementById('out')!
const log = (s: string) => (out.textContent += '\n' + s)
log(`page crossOriginIsolated=${self.crossOriginIsolated}`)
// Cross-origin model fetch under COEP (the x4plus model lives on Hugging Face).
fetch('https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/real_esrgan_x4.onnx')
  .then(async (r) => {
    const reader = r.body!.getReader()
    const { value } = await reader.read()
    await reader.cancel()
    log(`HF fetch ok=${r.ok} firstChunk=${value?.length ?? 0}B`)
  })
  .catch((e) => log(`HF fetch FAILED: ${e}`))
for (const forceWasm of [false, true]) {
  const w = new Worker(new URL('./worker/spike.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e) => log(JSON.stringify(e.data))
  w.onerror = (e) => log(`worker error: ${e.message}`)
  w.postMessage({ forceWasm })
}
```

`src/worker/spike.worker.ts`:
```ts
import { createSession, runTile } from './session'

self.onmessage = async (e: MessageEvent<{ forceWasm: boolean }>) => {
  try {
    const bytes = new Uint8Array(
      await (await fetch('/models/realesr-general-x4v3.onnx')).arrayBuffer(),
    )
    const { session, ep } = await createSession(bytes, e.data.forceWasm)
    const input = new Float32Array(3 * 64 * 64).map(() => Math.random())
    const t0 = performance.now()
    const y = await runTile(session, input, 64, 64)
    postMessage({
      forceWasm: e.data.forceWasm,
      ep,
      isolated: self.crossOriginIsolated,
      outLen: y.length, // expect 3*256*256 = 196608
      nonZero: y.some((v) => v > 0),
      ms: Math.round(performance.now() - t0),
    })
  } catch (err) {
    postMessage({ forceWasm: e.data.forceWasm, error: String(err) })
  }
}
```

- [ ] **Step 4: Run the spike in dev and against the real Cloudflare runtime**

1. `npm run dev`, open `http://localhost:5173/spike.html` in Chrome, then Safari 26.
2. `npm run build && npx wrangler dev`, open the printed URL + `/spike.html` in Chrome, then Safari. (`wrangler dev` serves `dist/` with `_headers` the way production does. The spike page is included because Vite builds every root `.html` only when listed — if `dist/spike.html` is missing, add `build: { rollupOptions: { input: ['index.html', 'spike.html'] } }` to `vite.config.ts` temporarily.)

Expected in each: `page crossOriginIsolated=true`; `HF fetch ok=true`; two worker lines, one with `ep: "webgpu"` (Chrome, Safari 26) and one with `ep: "wasm"`, both `isolated: true`, `outLen: 196608`, `nonZero: true`.

Safari must be checked by the user (ask them to open the URL and paste the output).

If the worker reports an error loading ORT from jsDelivr (cross-origin module / nested worker blocked), try in order, re-running Step 4 after each:
  a. `public/_headers` and `vite.config.ts`: `Cross-Origin-Embedder-Policy: credentialless`.
  b. Remove COOP/COEP from both files (WASM becomes single-threaded; WebGPU unaffected).

- [ ] **Step 5: Check deployed asset sizes**

Run: `find dist -type f -size +24M`
Expected: no output. If any ORT `.wasm` appears (Vite emitting ORT's referenced binaries), create `public/.assetsignore` containing `*.wasm`, rebuild, and confirm `npx wrangler deploy --dry-run` succeeds.

- [ ] **Step 6: Record results, delete the spike, commit**

Append to the spec a section:
```markdown
## Verification log (Task 3)

| Browser | Server | isolated | webgpu ms (64²) | wasm ms (64²) | HF fetch | COEP value used |
|---|---|---|---|---|---|---|
| (one row per run from Step 4) |
```
Delete `spike.html`, `src/spike.ts`, `src/worker/spike.worker.ts` and any temporary `rollupOptions.input`.

```bash
git add -A
git commit -m "feat: ORT session with WebGPU→WASM fallback; verify COOP/COEP with CDN wasm

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tiling, pixel conversion and the upscale core

**Files:**
- Create: `src/worker/tiling.ts`, `src/worker/pixels.ts`, `src/worker/upscaleCore.ts`
- Test: `tests/tiling.test.ts`, `tests/pixels.test.ts`, `tests/upscaleCore.test.ts`

**Interfaces:**
- Consumes: `RasterImage` (`src/types.ts`).
- Produces:
  - `tiling.ts`: `interface Rect { x; y; w; h }`, `planTiles(width, height, tile): Rect[]`, `reflect(i, n): number`, `extractTile(img: RasterImage, r: Rect, pad: number): RasterImage`, `pasteTile(out: RasterImage, tile: RasterImage, r: Rect, pad: number, scale: number): void`
  - `pixels.ts`: `toPlanarRgb(img): Float32Array`, `fromPlanarRgb(f: Float32Array, w, h): RasterImage`, `hasAlpha(img): boolean`, `alphaOf(img): Uint8ClampedArray`, `resizeChannelBilinear(src: Uint8ClampedArray, w, h, tw, th): Uint8ClampedArray`, `setAlpha(img, alpha): void`
  - `upscaleCore.ts`: `interface UpscaleOptions { tile: number; pad: number; modelScale: number; outScale: number; onTile?: (done: number, total: number) => void }`, `interface UpscaleDeps { run(input: Float32Array, w: number, h: number): Promise<Float32Array>; resize(img: RasterImage, tw: number, th: number): Promise<RasterImage> }`, `upscaleImage(img, opts, deps): Promise<RasterImage>`

- [ ] **Step 1: Write failing tiling tests**

`tests/tiling.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { planTiles, reflect, extractTile, pasteTile } from '../src/worker/tiling'
import type { RasterImage } from '../src/types'

function gradient(w: number, h: number): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = i % 256
    data[i * 4 + 1] = (i * 7) % 256
    data[i * 4 + 2] = (i * 13) % 256
    data[i * 4 + 3] = 255
  }
  return { width: w, height: h, data }
}

describe('planTiles', () => {
  it('covers every pixel exactly once', () => {
    for (const [w, h, t] of [[1, 1, 256], [300, 200, 128], [256, 512, 256], [5, 3, 2]]) {
      const hits = new Uint8Array(w * h)
      for (const r of planTiles(w, h, t))
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) hits[y * w + x]++
      expect(hits.every((c) => c === 1)).toBe(true)
    }
  })
  it('uses one tile for an image smaller than the tile', () => {
    expect(planTiles(10, 7, 256)).toEqual([{ x: 0, y: 0, w: 10, h: 7 }])
  })
})

describe('reflect', () => {
  it('mirrors without repeating the edge pixel', () => {
    expect([-2, -1, 0, 1, 2, 3, 4, 5].map((i) => reflect(i, 4))).toEqual([2, 1, 0, 1, 2, 3, 2, 1])
  })
  it('handles n=1 and offsets far larger than n', () => {
    expect(reflect(-16, 1)).toBe(0)
    expect(reflect(17, 1)).toBe(0)
    const v = reflect(-16, 3)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(3)
  })
})

describe('extractTile', () => {
  it('pads a 1x1 image by replicating its only pixel', () => {
    const img = gradient(1, 1)
    const t = extractTile(img, { x: 0, y: 0, w: 1, h: 1 }, 16)
    expect(t.width).toBe(33)
    expect(t.height).toBe(33)
    for (let i = 0; i < 33 * 33; i++) expect([...t.data.subarray(i * 4, i * 4 + 4)]).toEqual([...img.data])
  })
  it('keeps interior pixels in place', () => {
    const img = gradient(20, 20)
    const t = extractTile(img, { x: 4, y: 4, w: 8, h: 8 }, 2)
    // tile(2,2) is image(4,4)
    expect([...t.data.subarray((2 * t.width + 2) * 4, (2 * t.width + 2) * 4 + 4)]).toEqual([
      ...img.data.subarray((4 * 20 + 4) * 4, (4 * 20 + 4) * 4 + 4),
    ])
  })
})

describe('pasteTile', () => {
  it('crops pad*scale and writes the core at r*scale', () => {
    const out: RasterImage = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) }
    // padded tile at scale 2: core 2x2 → 4x4, pad 1 → 2px border each side → 8x8
    const tile: RasterImage = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) }
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) tile.data[(y * 8 + x) * 4] = 200
    pasteTile(out, tile, { x: 2, y: 0, w: 2, h: 2 }, 1, 2)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        expect(out.data[(y * 8 + x) * 4]).toBe(x >= 4 && y < 4 ? 200 : 0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/tiling.test.ts`
Expected: FAIL — cannot resolve `../src/worker/tiling`.

- [ ] **Step 3: Implement `src/worker/tiling.ts`**

```ts
import type { RasterImage } from '../types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Core rectangles (no padding) covering the image row by row; edge tiles are smaller. */
export function planTiles(width: number, height: number, tile: number): Rect[] {
  const rects: Rect[] = []
  for (let y = 0; y < height; y += tile)
    for (let x = 0; x < width; x += tile)
      rects.push({ x, y, w: Math.min(tile, width - x), h: Math.min(tile, height - y) })
  return rects
}

/** Mirror index i into [0, n) without repeating the edge pixel (…2 1 |0 1 2 3| 2 1…).
 *  Periodic, so any offset works, including pads larger than the image. */
export function reflect(i: number, n: number): number {
  if (n === 1) return 0
  const period = 2 * (n - 1)
  const m = ((i % period) + period) % period
  return m < n ? m : period - m
}

/** The core rect grown by `pad` on every side, reflect-padded at image edges. */
export function extractTile(img: RasterImage, r: Rect, pad: number): RasterImage {
  const w = r.w + 2 * pad
  const h = r.h + 2 * pad
  const data = new Uint8ClampedArray(w * h * 4)
  for (let ty = 0; ty < h; ty++) {
    const sy = reflect(r.y - pad + ty, img.height)
    for (let tx = 0; tx < w; tx++) {
      const s = (sy * img.width + reflect(r.x - pad + tx, img.width)) * 4
      const d = (ty * w + tx) * 4
      data[d] = img.data[s]
      data[d + 1] = img.data[s + 1]
      data[d + 2] = img.data[s + 2]
      data[d + 3] = img.data[s + 3]
    }
  }
  return { width: w, height: h, data }
}

/** Write an upscaled padded tile's core into `out`: drop pad*scale px per side, place at r*scale. */
export function pasteTile(
  out: RasterImage,
  tile: RasterImage,
  r: Rect,
  pad: number,
  scale: number,
): void {
  const p = pad * scale
  const cw = r.w * scale
  const ch = r.h * scale
  for (let y = 0; y < ch; y++) {
    const s = ((y + p) * tile.width + p) * 4
    const d = ((r.y * scale + y) * out.width + r.x * scale) * 4
    out.data.set(tile.data.subarray(s, s + cw * 4), d)
  }
}
```

- [ ] **Step 4: Run tiling tests**

Run: `npx vitest run tests/tiling.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing pixels tests**

`tests/pixels.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  toPlanarRgb,
  fromPlanarRgb,
  hasAlpha,
  alphaOf,
  resizeChannelBilinear,
  setAlpha,
} from '../src/worker/pixels'

describe('planar RGB', () => {
  it('round-trips RGB exactly and sets alpha to 255', () => {
    const img = { width: 2, height: 1, data: new Uint8ClampedArray([10, 20, 30, 7, 250, 0, 128, 99]) }
    const f = toPlanarRgb(img)
    expect(f.length).toBe(6)
    expect(f[0]).toBeCloseTo(10 / 255) // R plane first
    expect(f[2]).toBeCloseTo(20 / 255) // then G plane
    const back = fromPlanarRgb(f, 2, 1)
    expect([...back.data]).toEqual([10, 20, 30, 255, 250, 0, 128, 255])
  })
})

describe('alpha helpers', () => {
  it('detects any non-opaque pixel', () => {
    expect(hasAlpha({ width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) })).toBe(false)
    expect(hasAlpha({ width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 254]) })).toBe(true)
  })
  it('extracts and writes back the alpha channel', () => {
    const img = { width: 2, height: 1, data: new Uint8ClampedArray([1, 2, 3, 40, 5, 6, 7, 80]) }
    expect([...alphaOf(img)]).toEqual([40, 80])
    setAlpha(img, new Uint8ClampedArray([9, 8]))
    expect([...img.data]).toEqual([1, 2, 3, 9, 5, 6, 7, 8])
  })
})

describe('resizeChannelBilinear', () => {
  it('keeps a constant channel constant', () => {
    const out = resizeChannelBilinear(new Uint8ClampedArray(6).fill(128), 3, 2, 12, 8)
    expect(out.length).toBe(96)
    expect(out.every((v) => v === 128)).toBe(true)
  })
  it('interpolates between neighbours and keeps edges', () => {
    const out = resizeChannelBilinear(new Uint8ClampedArray([0, 255]), 2, 1, 8, 1)
    expect(out[0]).toBe(0)
    expect(out[7]).toBe(255)
    for (let i = 1; i < 8; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1])
  })
})
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run tests/pixels.test.ts`
Expected: FAIL — cannot resolve `../src/worker/pixels`.

- [ ] **Step 7: Implement `src/worker/pixels.ts`**

```ts
import type { RasterImage } from '../types'

/** RGBA bytes → planar float RGB in [0,1] ([R…, G…, B…]), the models' NCHW input. */
export function toPlanarRgb(img: RasterImage): Float32Array {
  const n = img.width * img.height
  const f = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) {
    f[i] = img.data[i * 4] / 255
    f[n + i] = img.data[i * 4 + 1] / 255
    f[2 * n + i] = img.data[i * 4 + 2] / 255
  }
  return f
}

/** Planar float RGB in [0,1] → opaque RGBA bytes. */
export function fromPlanarRgb(f: Float32Array, w: number, h: number): RasterImage {
  const n = w * h
  const data = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    data[i * 4] = Math.round(f[i] * 255)
    data[i * 4 + 1] = Math.round(f[n + i] * 255)
    data[i * 4 + 2] = Math.round(f[2 * n + i] * 255)
    data[i * 4 + 3] = 255
  }
  return { width: w, height: h, data }
}

export function hasAlpha(img: RasterImage): boolean {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return true
  return false
}

export function alphaOf(img: RasterImage): Uint8ClampedArray {
  const a = new Uint8ClampedArray(img.width * img.height)
  for (let i = 0; i < a.length; i++) a[i] = img.data[i * 4 + 3]
  return a
}

export function setAlpha(img: RasterImage, alpha: Uint8ClampedArray): void {
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i]
}

/** Single-channel bilinear resize with pixel-centre alignment (edges clamp). */
export function resizeChannelBilinear(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  tw: number,
  th: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tw * th)
  for (let y = 0; y < th; y++) {
    const sy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / th - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(h - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / tw - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(w - 1, x0 + 1)
      const fx = sx - x0
      const top = src[y0 * w + x0] * (1 - fx) + src[y0 * w + x1] * fx
      const bot = src[y1 * w + x0] * (1 - fx) + src[y1 * w + x1] * fx
      out[y * tw + x] = Math.round(top * (1 - fy) + bot * fy)
    }
  }
  return out
}
```

- [ ] **Step 8: Run pixels tests**

Run: `npx vitest run tests/pixels.test.ts`
Expected: PASS.

- [ ] **Step 9: Write failing upscale-core tests (seam round trip + alpha)**

`tests/upscaleCore.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { upscaleImage, type UpscaleDeps } from '../src/worker/upscaleCore'
import type { RasterImage } from '../src/types'

function noise(w: number, h: number, alpha = 255): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4)
  let s = 12345
  for (let i = 0; i < data.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    data[i] = i % 4 === 3 ? alpha : s % 256
  }
  return { width: w, height: h, data }
}

/** Nearest-neighbour RGBA upscale by k — the reference a seamless tiler must reproduce exactly. */
function nearest(img: RasterImage, k: number): RasterImage {
  const w = img.width * k
  const h = img.height * k
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / k) * img.width + Math.floor(x / k)) * 4
      data.set(img.data.subarray(s, s + 4), (y * w + x) * 4)
    }
  return { width: w, height: h, data }
}

// Fake model: planar RGB nearest ×4. Fake resize: nearest downsample by integer factor.
const deps: UpscaleDeps = {
  async run(input, w, h) {
    const n = w * h
    const W = w * 4
    const out = new Float32Array(3 * n * 16)
    for (let c = 0; c < 3; c++)
      for (let y = 0; y < h * 4; y++)
        for (let x = 0; x < W; x++)
          out[c * n * 16 + y * W + x] = input[c * n + Math.floor(y / 4) * w + Math.floor(x / 4)]
    return out
  },
  async resize(img, tw, th) {
    const k = img.width / tw
    const data = new Uint8ClampedArray(tw * th * 4)
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const s = (y * k * img.width + x * k) * 4
        data.set(img.data.subarray(s, s + 4), (y * tw + x) * 4)
      }
    return { width: tw, height: th, data }
  },
}

describe('upscaleImage', () => {
  for (const [w, h, tile] of [[37, 23, 8], [3, 5, 256], [1, 1, 256], [16, 16, 16]]) {
    it(`×4 tiled equals whole-image nearest ×4 (${w}x${h}, tile ${tile})`, async () => {
      const img = noise(w, h)
      const out = await upscaleImage(img, { tile, pad: 4, modelScale: 4, outScale: 4 }, deps)
      expect(out.width).toBe(w * 4)
      expect(out.data).toEqual(nearest(img, 4).data)
    })
  }
  it('×2 via per-tile downscale equals nearest ×2', async () => {
    const img = noise(29, 17)
    const out = await upscaleImage(img, { tile: 8, pad: 4, modelScale: 4, outScale: 2 }, deps)
    expect(out.data).toEqual(nearest(img, 2).data)
  })
  it('reports progress once per tile', async () => {
    const calls: [number, number][] = []
    await upscaleImage(
      noise(20, 10),
      { tile: 8, pad: 2, modelScale: 4, outScale: 4, onTile: (d, t) => calls.push([d, t]) },
      deps,
    )
    expect(calls).toEqual([[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]])
  })
  it('carries a transparent alpha channel through (models are RGB-only)', async () => {
    const out = await upscaleImage(noise(6, 4, 100), { tile: 4, pad: 2, modelScale: 4, outScale: 4 }, deps)
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(100)
  })
  it('leaves opaque images opaque', async () => {
    const out = await upscaleImage(noise(6, 4), { tile: 4, pad: 2, modelScale: 4, outScale: 4 }, deps)
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(255)
  })
})
```

- [ ] **Step 10: Run to verify failure**

Run: `npx vitest run tests/upscaleCore.test.ts`
Expected: FAIL — cannot resolve `../src/worker/upscaleCore`.

- [ ] **Step 11: Implement `src/worker/upscaleCore.ts`**

```ts
import type { RasterImage } from '../types'
import { planTiles, extractTile, pasteTile } from './tiling'
import {
  toPlanarRgb,
  fromPlanarRgb,
  hasAlpha,
  alphaOf,
  setAlpha,
  resizeChannelBilinear,
} from './pixels'

export interface UpscaleOptions {
  tile: number // core tile size in input px
  pad: number // context px per side, cropped after inference
  modelScale: number // the model's native factor (4)
  outScale: number // requested factor; must divide modelScale
  onTile?: (done: number, total: number) => void
}

export interface UpscaleDeps {
  /** Planar RGB [1,3,h,w] in [0,1] → planar RGB [1,3,h*modelScale,w*modelScale]. */
  run(input: Float32Array, w: number, h: number): Promise<Float32Array>
  /** High-quality RGBA resize (pica Lanczos in the worker). */
  resize(img: RasterImage, tw: number, th: number): Promise<RasterImage>
}

export async function upscaleImage(
  img: RasterImage,
  opts: UpscaleOptions,
  deps: UpscaleDeps,
): Promise<RasterImage> {
  const { tile, pad, modelScale, outScale } = opts
  const out: RasterImage = {
    width: img.width * outScale,
    height: img.height * outScale,
    data: new Uint8ClampedArray(img.width * outScale * img.height * outScale * 4),
  }
  const rects = planTiles(img.width, img.height, tile)
  for (const [i, r] of rects.entries()) {
    const t = extractTile(img, r, pad)
    const y = await deps.run(toPlanarRgb(t), t.width, t.height)
    let up = fromPlanarRgb(y, t.width * modelScale, t.height * modelScale)
    // Downscale the whole padded tile, then crop: the pad keeps the resize kernel off the seam.
    if (outScale !== modelScale) up = await deps.resize(up, t.width * outScale, t.height * outScale)
    pasteTile(out, up, r, pad, outScale)
    opts.onTile?.(i + 1, rects.length)
  }
  if (hasAlpha(img))
    setAlpha(out, resizeChannelBilinear(alphaOf(img), img.width, img.height, out.width, out.height))
  return out
}
```

- [ ] **Step 12: Run all tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 13: Commit**

```bash
git add src/worker/tiling.ts src/worker/pixels.ts src/worker/upscaleCore.ts tests/tiling.test.ts tests/pixels.test.ts tests/upscaleCore.test.ts
git commit -m "feat: seamless tiled upscale core with alpha passthrough

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Size limits and decoding

**Files:**
- Create: `src/lib/limits.ts`, `src/lib/decode.ts`
- Test: `tests/limits.test.ts`, `tests/decode.test.ts`

**Interfaces:**
- Produces:
  - `limits.ts`: `MAX_OUTPUT_SIDE = 8192`, `MAX_PIXELS_DESKTOP = 8192 * 8192`, `MAX_PIXELS_APPLE_TOUCH = 16_777_216`, `fitInput(w: number, h: number, scale: number, maxPixels: number): { ok: boolean; w: number; h: number }`
  - `decode.ts`: `fileToRasterImage(file: Blob): Promise<RasterImage>` (throws `Error('undecodable')`), `resampleSteps(w, h, tw, th): { w: number; h: number }[]`, `resizeImage(img: RasterImage, tw: number, th: number): RasterImage`

- [ ] **Step 1: Write failing tests**

`tests/limits.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { fitInput, MAX_PIXELS_DESKTOP, MAX_PIXELS_APPLE_TOUCH } from '../src/lib/limits'

describe('fitInput', () => {
  it('accepts an input whose output fits', () => {
    expect(fitInput(2048, 1024, 4, MAX_PIXELS_DESKTOP)).toEqual({ ok: true, w: 2048, h: 1024 })
  })
  it('shrinks to the 8192 side cap, keeping aspect', () => {
    expect(fitInput(4000, 1000, 4, MAX_PIXELS_DESKTOP)).toEqual({ ok: false, w: 2048, h: 512 })
  })
  it('×2 allows twice the input side', () => {
    expect(fitInput(4096, 100, 2, MAX_PIXELS_DESKTOP).ok).toBe(true)
  })
  it('applies the iPhone/iPad canvas area cap', () => {
    const r = fitInput(2000, 2000, 4, MAX_PIXELS_APPLE_TOUCH)
    expect(r.ok).toBe(false)
    expect(r.w * 4 * r.h * 4).toBeLessThanOrEqual(MAX_PIXELS_APPLE_TOUCH)
    expect(r.w).toBe(r.h)
  })
  it('never returns a zero dimension', () => {
    const r = fitInput(100000, 3, 4, MAX_PIXELS_DESKTOP)
    expect(r.h).toBeGreaterThanOrEqual(1)
  })
})
```

`tests/decode.test.ts` (resampleSteps is ported from the vectorizer; canvas code is browser-only and checked manually):
```ts
import { describe, it, expect } from 'vitest'
import { resampleSteps } from '../src/lib/decode'

describe('resampleSteps', () => {
  it('is one step for ≤2× reductions', () => {
    expect(resampleSteps(100, 100, 60, 60)).toEqual([{ w: 60, h: 60 }])
  })
  it('halves until within 2×, ending exactly on target', () => {
    expect(resampleSteps(1000, 800, 100, 80)).toEqual([
      { w: 500, h: 400 },
      { w: 250, h: 200 },
      { w: 125, h: 100 },
      { w: 100, h: 80 },
    ])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/limits.test.ts tests/decode.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/lib/limits.ts`**

```ts
/** Output caps. 8192² RGBA is 256 MB — the most we hold in memory at once. iPhone/iPad Safari
 *  refuses canvases over 16.7 MP, so the result could not even be displayed there. */
export const MAX_OUTPUT_SIDE = 8192
export const MAX_PIXELS_DESKTOP = 8192 * 8192
export const MAX_PIXELS_APPLE_TOUCH = 16_777_216

/** Largest input (same aspect) whose ×scale output fits both caps. ok = input already fits. */
export function fitInput(
  w: number,
  h: number,
  scale: number,
  maxPixels: number,
): { ok: boolean; w: number; h: number } {
  const k = Math.min(
    1,
    MAX_OUTPUT_SIDE / (Math.max(w, h) * scale),
    Math.sqrt(maxPixels / (w * h * scale * scale)),
  )
  if (k >= 1) return { ok: true, w, h }
  // Epsilon: 4000 * (8192 / 16000) lands a hair under 2048 in floating point.
  const dim = (v: number) => Math.max(1, Math.floor(v * k + 1e-9))
  return { ok: false, w: dim(w), h: dim(h) }
}
```

- [ ] **Step 4: Implement `src/lib/decode.ts`**

```ts
import type { RasterImage } from '../types'

export async function fileToRasterImage(file: Blob): Promise<RasterImage> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error('undecodable')
  }
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0) // transparency kept: the upscaler carries alpha through
  bmp.close()
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { width: d.width, height: d.height, data: d.data }
}

/** Successive drawImage sizes, each at most a 2× reduction, ending on the target. Ported from
 *  slop-vectorizer: Chrome point-samples a single drawImage past ~2× minification. */
export function resampleSteps(
  w: number,
  h: number,
  tw: number,
  th: number,
): { w: number; h: number }[] {
  const steps: { w: number; h: number }[] = []
  while (w > tw * 2 || h > th * 2) {
    w = Math.max(tw, Math.ceil(w / 2))
    h = Math.max(th, Math.ceil(h / 2))
    steps.push({ w, h })
  }
  if (steps.length === 0 || steps[steps.length - 1].w !== tw || steps[steps.length - 1].h !== th)
    steps.push({ w: tw, h: th })
  return steps
}

/** Downscale for the size-cap dialog. */
export function resizeImage(img: RasterImage, tw: number, th: number): RasterImage {
  let src = new OffscreenCanvas(img.width, img.height)
  src.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
  for (const step of resampleSteps(img.width, img.height, tw, th)) {
    const c = new OffscreenCanvas(step.w, step.h)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, step.w, step.h)
    src = c
  }
  const d = src.getContext('2d')!.getImageData(0, 0, tw, th)
  return { width: tw, height: th, data: d.data }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run check`
Expected: PASS; check clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/limits.ts src/lib/decode.ts tests/limits.test.ts tests/decode.test.ts
git commit -m "feat: output size caps and alpha-preserving decode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Model registry and download cache

**Files:**
- Create: `src/lib/models.ts`, `src/lib/modelCache.ts`
- Modify: `src/types.ts`
- Test: `tests/modelCache.test.ts`

**Interfaces:**
- Consumes: byte sizes from Task 2 Step 2, HF sha from Task 2 Step 3.
- Produces:
  - `src/types.ts`: `type ModelId = 'general' | 'anime' | 'photo'`
  - `models.ts`: `interface ModelInfo { id: ModelId; label: string; url: string; bytes: number; slowOnCpu: boolean }`, `MODELS: Record<ModelId, ModelInfo>`, `MODEL_ORDER: ModelId[]`, `DEFAULT_MODEL: ModelId = 'general'`
  - `modelCache.ts`: `class ModelDownloadError extends Error`, `interface CacheLike { match(url: string): Promise<Response | undefined>; put(url: string, res: Response): Promise<void> }`, `openModelCache(): Promise<CacheLike | null>`, `loadModel(url: string, onProgress: (loaded: number, total: number) => void, cache: CacheLike | null, fetchFn?: typeof fetch): Promise<Uint8Array>`

- [ ] **Step 1: Write failing tests**

`tests/modelCache.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { loadModel, ModelDownloadError, type CacheLike } from '../src/lib/modelCache'

function memCache(): CacheLike & { store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>()
  return {
    store,
    async match(url) {
      const b = store.get(url)
      return b ? new Response(b) : undefined
    },
    async put(url, res) {
      store.set(url, new Uint8Array(await res.arrayBuffer()))
    },
  }
}

const bytes = new Uint8Array([1, 2, 3, 4, 5, 6])
const okFetch = (async () =>
  new Response(bytes, { headers: { 'content-length': '6' } })) as unknown as typeof fetch

describe('loadModel', () => {
  it('downloads with progress and caches', async () => {
    const cache = memCache()
    const seen: [number, number][] = []
    const got = await loadModel('/m.onnx', (l, t) => seen.push([l, t]), cache, okFetch)
    expect([...got]).toEqual([...bytes])
    expect(seen.at(-1)).toEqual([6, 6])
    expect([...cache.store.get('/m.onnx')!]).toEqual([...bytes])
  })
  it('serves from cache without fetching', async () => {
    const cache = memCache()
    cache.store.set('/m.onnx', bytes)
    const failFetch = (async () => {
      throw new Error('should not fetch')
    }) as unknown as typeof fetch
    expect([...(await loadModel('/m.onnx', () => {}, cache, failFetch))]).toEqual([...bytes])
  })
  it('throws ModelDownloadError on HTTP errors', async () => {
    const f = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch
    await expect(loadModel('/m.onnx', () => {}, memCache(), f)).rejects.toBeInstanceOf(
      ModelDownloadError,
    )
  })
  it('does not cache a download interrupted mid-stream', async () => {
    const cache = memCache()
    const f = (async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array([1, 2]))
            c.error(new Error('network lost'))
          },
        }),
      )) as unknown as typeof fetch
    await expect(loadModel('/m.onnx', () => {}, cache, f)).rejects.toBeInstanceOf(ModelDownloadError)
    expect(cache.store.size).toBe(0)
  })
  it('works without a cache (storage unavailable)', async () => {
    expect([...(await loadModel('/m.onnx', () => {}, null, okFetch))]).toEqual([...bytes])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/modelCache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/modelCache.ts`**

```ts
export class ModelDownloadError extends Error {}

export interface CacheLike {
  match(url: string): Promise<Response | undefined>
  put(url: string, res: Response): Promise<void>
}

// Bump the suffix if a model file changes at the same URL.
const CACHE_NAME = 'slop-upscaler-models-v1'

export async function openModelCache(): Promise<CacheLike | null> {
  try {
    return await caches.open(CACHE_NAME)
  } catch {
    return null // private mode / storage blocked: download every time
  }
}

/** Model bytes from the cache, or downloaded with progress and then cached. Only a complete
 *  download is cached — a partial file would make every later session creation fail. */
export async function loadModel(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  cache: CacheLike | null,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array> {
  const hit = await cache?.match(url)
  if (hit) return new Uint8Array(await hit.arrayBuffer())

  const chunks: Uint8Array[] = []
  let loaded = 0
  let total = 0
  try {
    const res = await fetchFn(url)
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    total = Number(res.headers.get('content-length')) || 0
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      onProgress(loaded, total)
    }
  } catch (err) {
    throw new ModelDownloadError(err instanceof Error ? err.message : String(err))
  }
  const bytes = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) {
    bytes.set(c, o)
    o += c.length
  }
  try {
    await cache?.put(url, new Response(bytes))
  } catch {
    // quota exceeded: still usable this session
  }
  return bytes
}
```

- [ ] **Step 4: Implement `src/lib/models.ts` and extend types**

Add to `src/types.ts`:
```ts
export type ModelId = 'general' | 'anime' | 'photo'
```

`src/lib/models.ts` — replace `GENERAL_BYTES`/`ANIME_BYTES` with the sizes printed in Task 2 Step 2 and `HF_SHA` with the sha from Task 2 Step 3 (if Task 2 Step 3 failed, use the URL the user chose instead):
```ts
import type { ModelId } from '../types'

export interface ModelInfo {
  id: ModelId
  label: string
  url: string
  bytes: number
  slowOnCpu: boolean
}

const base = import.meta.env.BASE_URL
// Pinned to a commit so the cached bytes never silently change under the same URL.
const HF_SHA = '<sha from Task 2 Step 3>'

export const MODELS: Record<ModelId, ModelInfo> = {
  general: {
    id: 'general',
    label: 'General (fast)',
    url: `${base}models/realesr-general-x4v3.onnx`,
    bytes: GENERAL_BYTES,
    slowOnCpu: false,
  },
  anime: {
    id: 'anime',
    label: 'Anime / illustration',
    url: `${base}models/realesrgan-x4plus-anime-6b.onnx`,
    bytes: ANIME_BYTES,
    slowOnCpu: false,
  },
  photo: {
    id: 'photo',
    label: 'Photo (high quality)',
    url: `https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/${HF_SHA}/real_esrgan_x4.onnx`,
    bytes: 67_051_616,
    slowOnCpu: true,
  },
}

export const MODEL_ORDER: ModelId[] = ['general', 'anime', 'photo']
export const DEFAULT_MODEL: ModelId = 'general'
```

- [ ] **Step 5: Run tests and check**

Run: `npm test && npm run check`
Expected: PASS; check clean (no `<sha …>` / `*_BYTES` placeholders left — `grep -n "BYTES\|<sha" src/lib/models.ts` shows only numeric literals).

- [ ] **Step 6: Commit**

```bash
git add src/lib/models.ts src/lib/modelCache.ts src/types.ts tests/modelCache.test.ts
git commit -m "feat: model registry and Cache Storage download with progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Upscale worker and client

**Files:**
- Create: `src/worker/upscale.worker.ts`, `src/lib/workerClient.ts`
- Modify: `src/types.ts`
- Test: `tests/workerClient.test.ts`

**Interfaces:**
- Consumes: `createSession`, `runTile` (Task 3); `upscaleImage` (Task 4); `MODELS`, `loadModel`, `openModelCache`, `ModelDownloadError` (Task 6).
- Produces (types in `src/types.ts`):
```ts
export type Scale = 2 | 4
export type UpscaleProgress =
  | { phase: 'download'; loaded: number; total: number }
  | { phase: 'init' }
  | { phase: 'tiles'; done: number; total: number }
export interface UpscaleRequest {
  type: 'upscale'
  jobId: number
  image: RasterImage
  modelId: ModelId
  scale: Scale
  forceWasm: boolean
}
export type WorkerResponse =
  | { type: 'progress'; jobId: number; progress: UpscaleProgress }
  | { type: 'ep'; jobId: number; ep: Ep }
  | { type: 'result'; jobId: number; image: RasterImage }
  | { type: 'error'; jobId: number; kind: 'download' | 'runtime'; message: string }
```
  - `class UpscaleError extends Error { kind: 'download' | 'runtime' }`
  - `class UpscalerClient { upscale(image, modelId, scale, forceWasm, onProgress: (p: UpscaleProgress) => void, onEp: (ep: Ep) => void): Promise<RasterImage>; cancel(): void }` — rejects with `Error('cancelled')` when superseded or cancelled.

- [ ] **Step 1: Add the types above to `src/types.ts`**

- [ ] **Step 2: Write failing client tests**

`tests/workerClient.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { UpscalerClient, UpscaleError } from '../src/lib/workerClient'
import type { RasterImage, UpscaleRequest, WorkerResponse } from '../src/types'

class FakeWorker {
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null
  posted: UpscaleRequest[] = []
  terminated = false
  postMessage(msg: UpscaleRequest): void {
    this.posted.push(msg)
  }
  terminate(): void {
    this.terminated = true
  }
  emit(m: WorkerResponse) {
    this.onmessage?.({ data: m } as MessageEvent<WorkerResponse>)
  }
}
const instances: FakeWorker[] = []
;(globalThis as unknown as { Worker: unknown }).Worker = class extends FakeWorker {
  constructor() {
    super()
    instances.push(this)
  }
}

const img = (): RasterImage => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) })

describe('UpscalerClient', () => {
  it('resolves with the result and forwards progress and ep', async () => {
    instances.length = 0
    const c = new UpscalerClient()
    const progress: unknown[] = []
    const eps: string[] = []
    const p = c.upscale(img(), 'general', 4, false, (x) => progress.push(x), (e) => eps.push(e))
    const w = instances[0]
    const jobId = w.posted[0].jobId
    w.emit({ type: 'ep', jobId, ep: 'webgpu' })
    w.emit({ type: 'progress', jobId, progress: { phase: 'tiles', done: 1, total: 2 } })
    w.emit({ type: 'result', jobId, image: img() })
    await expect(p).resolves.toMatchObject({ width: 1 })
    expect(eps).toEqual(['webgpu'])
    expect(progress).toEqual([{ phase: 'tiles', done: 1, total: 2 }])
  })
  it('does not transfer (detach) the caller image', () => {
    instances.length = 0
    const c = new UpscalerClient()
    const src = img()
    void c.upscale(src, 'general', 4, false, () => {}, () => {}).catch(() => {})
    expect(instances[0].posted[0].image.data).not.toBe(src.data)
  })
  it('rejects with a typed error', async () => {
    instances.length = 0
    const c = new UpscalerClient()
    const p = c.upscale(img(), 'general', 4, false, () => {}, () => {})
    const w = instances[0]
    w.emit({ type: 'error', jobId: w.posted[0].jobId, kind: 'download', message: 'HTTP 404' })
    const err = await p.catch((e) => e)
    expect(err).toBeInstanceOf(UpscaleError)
    expect(err.kind).toBe('download')
  })
  it('cancel terminates, rejects "cancelled", and ignores the old worker afterwards', async () => {
    instances.length = 0
    const c = new UpscalerClient()
    const progress: unknown[] = []
    const p1 = c.upscale(img(), 'general', 4, false, (x) => progress.push(x), () => {})
    const old = instances[0]
    const oldJob = old.posted[0].jobId
    c.cancel()
    await expect(p1).rejects.toThrow('cancelled')
    expect(old.terminated).toBe(true)
    const p2 = c.upscale(img(), 'general', 4, false, (x) => progress.push(x), () => {})
    const fresh = instances[1]
    old.emit({ type: 'progress', jobId: oldJob, progress: { phase: 'init' } })
    old.emit({ type: 'result', jobId: oldJob, image: img() })
    fresh.emit({ type: 'result', jobId: fresh.posted[0].jobId, image: img() })
    await expect(p2).resolves.toBeDefined()
    expect(progress).toEqual([])
  })
  it('a new call supersedes an unsettled one', async () => {
    instances.length = 0
    const c = new UpscalerClient()
    const p1 = c.upscale(img(), 'general', 4, false, () => {}, () => {})
    const p2 = c.upscale(img(), 'anime', 4, false, () => {}, () => {})
    await expect(p1).rejects.toThrow('cancelled')
    const w = instances[0]
    w.emit({ type: 'result', jobId: w.posted[0].jobId, image: img() }) // stale
    w.emit({ type: 'result', jobId: w.posted[1].jobId, image: img() })
    await expect(p2).resolves.toBeDefined()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/workerClient.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/lib/workerClient.ts`**

```ts
import type {
  Ep,
  ModelId,
  RasterImage,
  Scale,
  UpscaleProgress,
  UpscaleRequest,
  WorkerResponse,
} from '../types'

export class UpscaleError extends Error {
  constructor(
    public kind: 'download' | 'runtime',
    message: string,
  ) {
    super(message)
  }
}

export class UpscalerClient {
  private worker: Worker
  private jobId = 0
  private pending: { reject: (e: Error) => void } | null = null

  constructor() {
    this.worker = this.spawn()
  }

  private spawn(): Worker {
    return new Worker(new URL('../worker/upscale.worker.ts', import.meta.url), { type: 'module' })
  }

  upscale(
    image: RasterImage,
    modelId: ModelId,
    scale: Scale,
    forceWasm: boolean,
    onProgress: (p: UpscaleProgress) => void,
    onEp: (ep: Ep) => void,
  ): Promise<RasterImage> {
    this.pending?.reject(new Error('cancelled'))
    const jobId = ++this.jobId
    const worker = this.worker
    return new Promise<RasterImage>((resolve, reject) => {
      this.pending = { reject }
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const m = e.data
        // Stale job, or a worker cancel() already replaced.
        if (m.jobId !== this.jobId || worker !== this.worker) return
        if (m.type === 'progress') onProgress(m.progress)
        else if (m.type === 'ep') onEp(m.ep)
        else if (m.type === 'result') {
          this.pending = null
          resolve(m.image)
        } else {
          this.pending = null
          reject(new UpscaleError(m.kind, m.message))
        }
      }
      worker.onerror = (e) => {
        if (worker !== this.worker) return
        this.pending = null
        reject(new UpscaleError('runtime', e.message))
      }
      // Copy, then transfer the copy: the caller keeps displaying the original.
      const copy = { ...image, data: image.data.slice() }
      const req: UpscaleRequest = { type: 'upscale', jobId, image: copy, modelId, scale, forceWasm }
      worker.postMessage(req, [copy.data.buffer])
    })
  }

  cancel(): void {
    this.worker.terminate()
    this.pending?.reject(new Error('cancelled'))
    this.pending = null
    this.jobId++
    this.worker = this.spawn()
  }
}
```

Note: the FakeWorker's `postMessage(msg)` ignores the transfer list; that is fine.

- [ ] **Step 5: Run client tests**

Run: `npx vitest run tests/workerClient.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement `src/worker/upscale.worker.ts`**

```ts
import pica from 'pica'
import type { Ep, InferenceSession } from './sessionTypes'
import type { RasterImage, UpscaleRequest, WorkerResponse } from '../types'
import { MODELS } from '../lib/models'
import { loadModel, openModelCache, ModelDownloadError } from '../lib/modelCache'
import { createSession, runTile } from './session'
import { upscaleImage } from './upscaleCore'

const resizer = pica({ features: ['js', 'wasm'] }) // no nested workers inside our worker
let current: { key: string; session: InferenceSession; ep: Ep } | null = null

const post = (m: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(m, transfer)

async function lanczos(img: RasterImage, tw: number, th: number): Promise<RasterImage> {
  const out = await resizer.resizeBuffer({
    src: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength),
    width: img.width,
    height: img.height,
    toWidth: tw,
    toHeight: th,
    filter: 'lanczos3',
  })
  return { width: tw, height: th, data: new Uint8ClampedArray(out.buffer, out.byteOffset, out.byteLength) }
}

self.onmessage = async (e: MessageEvent<UpscaleRequest>) => {
  const { jobId, image, modelId, scale, forceWasm } = e.data
  try {
    const key = `${modelId}:${forceWasm}`
    if (current?.key !== key) {
      await current?.session.release()
      current = null
      const model = MODELS[modelId]
      const bytes = await loadModel(
        model.url,
        (loaded, total) =>
          post({ type: 'progress', jobId, progress: { phase: 'download', loaded, total: total || model.bytes } }),
        await openModelCache(),
      )
      post({ type: 'progress', jobId, progress: { phase: 'init' } })
      current = { key, ...(await createSession(bytes, forceWasm)) }
    }
    const { session, ep } = current
    post({ type: 'ep', jobId, ep })
    const out = await upscaleImage(
      image,
      {
        tile: ep === 'webgpu' ? 512 : 256,
        pad: 16,
        modelScale: 4,
        outScale: scale,
        onTile: (done, total) => post({ type: 'progress', jobId, progress: { phase: 'tiles', done, total } }),
      },
      { run: (input, w, h) => runTile(session, input, w, h), resize: lanczos },
    )
    post({ type: 'result', jobId, image: out }, [out.data.buffer])
  } catch (err) {
    post({
      type: 'error',
      jobId,
      kind: err instanceof ModelDownloadError ? 'download' : 'runtime',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
```

Create `src/worker/sessionTypes.ts` so the worker doesn't import `ort` just for a type:
```ts
export type { InferenceSession } from 'onnxruntime-web/webgpu'
export type { Ep } from '../types'
```

- [ ] **Step 7: Verify types and pica API**

Run: `npm run check && npm test`
Expected: clean. If `pica` has no types, `npm install -D @types/pica` and re-run. If `resizeBuffer` has a different option name for the filter in the installed pica version (check `node_modules/pica/README.md` for "resizeBuffer"), use the documented Lanczos-3 option name.

- [ ] **Step 8: Commit**

```bash
git add src/worker/upscale.worker.ts src/worker/sessionTypes.ts src/lib/workerClient.ts src/types.ts tests/workerClient.test.ts package.json package-lock.json
git commit -m "feat: upscale worker (cache, session, tiles, pica ×2) and cancellable client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Viewer — viewport, compare view and panes

**Files:**
- Create: `src/lib/viewport.svelte.ts`, `src/lib/viewportMath.ts`, `src/lib/sliderFill.ts` (copied), `src/lib/CompareView.svelte`, `src/lib/ImagePane.svelte` (adapted)
- Test: `tests/viewportMath.test.ts` (copied)

**Interfaces:**
- Produces:
  - `Viewport` class (`zoom`, `panX`, `panY`, `touched`, `wheelAt`, `zoomAt`, `panBy`, `fitTo(cw, ch, iw, ih)`) — unchanged from vectorizer.
  - `sliderFill(value, min, max): string` — unchanged.
  - `<CompareView original result viewport width height />` — `original: RasterImage`, `result: RasterImage`, `width`/`height`: view-space size (= original × scale).
  - `<ImagePane image label viewport width height />` — `image: RasterImage | null`.

- [ ] **Step 1: Copy unchanged files and their test**

```bash
V=../slop-vectorizer
cp $V/src/lib/viewport.svelte.ts $V/src/lib/viewportMath.ts $V/src/lib/sliderFill.ts src/lib/
cp $V/tests/viewportMath.test.ts tests/
```

Run: `npx vitest run tests/viewportMath.test.ts`
Expected: PASS.

- [ ] **Step 2: Write `src/lib/CompareView.svelte`**

Adapted from `../slop-vectorizer/src/lib/CompareView.svelte`: the circle gizmos are removed, the SVG layer becomes the result canvas, and both canvases are sized to the view space (the original is stretched ×scale with `pixelated`, so it shows the input's real pixels at the output's size).

```svelte
<!-- src/lib/CompareView.svelte -->
<script lang="ts">
  import type { RasterImage } from '../types'
  import type { Viewport } from './viewport.svelte'
  import { pinchStep, type Point } from './viewportMath'

  let {
    original,
    result,
    viewport,
    width,
    height,
  }: {
    original: RasterImage
    result: RasterImage
    viewport: Viewport
    width: number // view space = output pixels
    height: number
  } = $props()

  let divider = $state(50) // percent
  let container: HTMLDivElement
  let origCanvas = $state<HTMLCanvasElement | null>(null)
  let resultCanvas = $state<HTMLCanvasElement | null>(null)
  const pointers = new Map<number, Point>()
  let draggingDivider = false

  function paint(canvas: HTMLCanvasElement | null, img: RasterImage) {
    if (!canvas) return
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
  }
  $effect(() => paint(origCanvas, original))
  $effect(() => paint(resultCanvas, result))

  function wheel(e: WheelEvent) {
    e.preventDefault()
    const r = container.getBoundingClientRect()
    viewport.wheelAt(e.clientX - r.left, e.clientY - r.top, e.deltaY)
  }
  function down(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    if (draggingDivider) {
      const r = container.getBoundingClientRect()
      divider = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100))
      return
    }
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.size === 1) {
      viewport.panBy(cur.x - prev.x, cur.y - prev.y)
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1]
      const s = pinchStep(prev, other, cur, other)
      const r = container.getBoundingClientRect()
      viewport.zoomAt(s.cx - r.left, s.cy - r.top, s.factor)
      viewport.panBy(s.dx, s.dy)
    }
    pointers.set(e.pointerId, cur)
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId)
    draggingDivider = false
  }
</script>

<div
  class="compare"
  bind:this={container}
  onwheel={wheel}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  role="img"
  aria-label="Compare original and upscaled"
>
  <!-- clip-path lives on an UNtransformed wrapper so it stays in screen space
       (aligned with the divider line); the transform is on the inner layer. -->
  <div class="clip" style:clip-path={`inset(0 ${100 - divider}% 0 0)`}>
    <div
      class="layer"
      style:transform={`translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`}
      style:--zoom={viewport.zoom}
    >
      <canvas
        bind:this={origCanvas}
        style:width={`${width}px`}
        style:height={`${height}px`}
        style:image-rendering="pixelated"
      ></canvas>
    </div>
  </div>
  <div class="clip" style:clip-path={`inset(0 0 0 ${divider}%)`}>
    <div
      class="layer"
      style:transform={`translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`}
      style:--zoom={viewport.zoom}
    >
      <canvas bind:this={resultCanvas} style:width={`${width}px`} style:height={`${height}px`}
      ></canvas>
    </div>
  </div>
  <span class="tag left">Original</span>
  <span class="tag right">Upscaled</span>
  <div
    class="divider"
    style:left={`${divider}%`}
    onpointerdown={(e) => {
      e.stopPropagation()
      draggingDivider = true
      ;(e.target as Element).setPointerCapture(e.pointerId)
    }}
    onpointermove={move}
    onpointerup={up}
    onkeydown={(e) => {
      if (e.key === 'ArrowLeft') divider = Math.max(2, divider - 2)
      else if (e.key === 'ArrowRight') divider = Math.min(98, divider + 2)
      else return
      e.preventDefault()
    }}
    role="slider"
    aria-label="Comparison divider"
    aria-orientation="vertical"
    aria-valuenow={Math.round(divider)}
    aria-valuemin={2}
    aria-valuemax={98}
    tabindex="0"
  ></div>
</div>

<style>
  .compare {
    position: relative;
    overflow: hidden;
    height: 100%;
    background: var(--color-ground);
    touch-action: none;
    cursor: grab;
  }
  .clip {
    position: absolute;
    inset: 0;
  }
  .layer {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
  }
  /* Checker on the artwork itself; 16 screen px at any zoom. */
  .layer canvas {
    display: block;
    --check: calc(16px / var(--zoom, 1));
    background: repeating-conic-gradient(var(--color-check-b) 0% 25%, var(--color-check-a) 0% 50%) 0
      0 / var(--check) var(--check);
  }
  .tag {
    position: absolute;
    top: 8px;
    font-size: 11px;
    color: var(--color-muted);
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    border-radius: 999px;
    padding: 2px 8px;
    pointer-events: none;
  }
  .tag.left {
    left: 8px;
  }
  .tag.right {
    right: 8px;
  }
  .divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8px;
    margin-left: -4px;
    cursor: col-resize;
    background: transparent;
  }
  .divider::after {
    content: '';
    position: absolute;
    inset: 0 3px;
    background: var(--color-accent);
  }
</style>
```

- [ ] **Step 3: Write `src/lib/ImagePane.svelte`**

Adapted from `../slop-vectorizer/src/lib/ImagePane.svelte`: gizmos and the SVG branch removed, canvas sized to view space, and a "Not upscaled yet" placeholder for the empty result pane.

```svelte
<!-- src/lib/ImagePane.svelte -->
<script lang="ts">
  import type { RasterImage } from '../types'
  import type { Viewport } from './viewport.svelte'
  import { pinchStep, type Point } from './viewportMath'

  let {
    image,
    label,
    viewport,
    width,
    height,
    pixelated = false,
  }: {
    image: RasterImage | null
    label: string
    viewport: Viewport
    width: number // view space = output pixels
    height: number
    pixelated?: boolean
  } = $props()

  let el: HTMLDivElement
  let canvas = $state<HTMLCanvasElement | null>(null)
  const pointers = new Map<number, Point>()

  $effect(() => {
    if (!canvas || !image) return
    canvas.width = image.width
    canvas.height = image.height
    canvas
      .getContext('2d')!
      .putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
  })

  function wheel(e: WheelEvent) {
    e.preventDefault()
    const r = el.getBoundingClientRect()
    viewport.wheelAt(e.clientX - r.left, e.clientY - r.top, e.deltaY)
  }
  function down(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.size === 1) {
      viewport.panBy(cur.x - prev.x, cur.y - prev.y)
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1]
      const s = pinchStep(prev, other, cur, other)
      const r = el.getBoundingClientRect()
      viewport.zoomAt(s.cx - r.left, s.cy - r.top, s.factor)
      viewport.panBy(s.dx, s.dy)
    }
    pointers.set(e.pointerId, cur)
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId)
  }
</script>

<div
  class="pane"
  bind:this={el}
  onwheel={wheel}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  role="img"
  aria-label={label}
>
  <div
    class="layer"
    style:transform={`translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`}
    style:--zoom={viewport.zoom}
  >
    {#if image}
      <canvas
        bind:this={canvas}
        style:width={`${width}px`}
        style:height={`${height}px`}
        style:image-rendering={pixelated ? 'pixelated' : null}
      ></canvas>
    {:else}
      <div class="placeholder" style:width={`${width}px`} style:height={`${height}px`}>
        <span>Not upscaled yet</span>
      </div>
    {/if}
  </div>
  <span class="pane-label">{label}</span>
</div>

<style>
  .pane {
    position: relative;
    overflow: hidden;
    background: var(--color-ground);
    touch-action: none;
    cursor: grab;
  }
  .layer {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
  }
  /* Checker on the artwork itself; 16 screen px at any zoom. */
  .layer canvas {
    display: block;
    --check: calc(16px / var(--zoom, 1));
    background: repeating-conic-gradient(var(--color-check-b) 0% 25%, var(--color-check-a) 0% 50%) 0
      0 / var(--check) var(--check);
  }
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    border: calc(2px / var(--zoom, 1)) dashed var(--color-line);
    box-sizing: border-box;
  }
  .placeholder span {
    color: var(--color-muted);
    font-size: calc(12px / var(--zoom, 1));
  }
  .pane-label {
    position: absolute;
    top: 8px;
    left: 10px;
    font-size: 11px;
    color: var(--color-muted);
    background: color-mix(in srgb, var(--color-panel) 85%, transparent);
    padding: 2px 8px;
    border-radius: 4px;
    pointer-events: none;
  }
</style>
```

If svelte-check rejects `new ImageData(image.data, …)` (TS `ArrayBufferLike` vs `ArrayBuffer` typing), use `new ImageData(new Uint8ClampedArray(image.data), …)` as the vectorizer does — same fix in `CompareView`, `decode.ts` and `exportImage.ts`.

- [ ] **Step 4: Verify**

Run: `npm run check && npm test`
Expected: clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viewport.svelte.ts src/lib/viewportMath.ts src/lib/sliderFill.ts src/lib/CompareView.svelte src/lib/ImagePane.svelte tests/viewportMath.test.ts
git commit -m "feat: synced split and side-by-side viewers (ported from slop-vectorizer)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Export and saving

**Files:**
- Create: `src/lib/exportImage.ts`, `src/lib/share.ts` (copied), `src/lib/saveFile.ts` (adapted)
- Test: `tests/exportImage.test.ts`

**Interfaces:**
- Produces:
  - `type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp'`
  - `exportName(sourceName: string | undefined, scale: number, mime: string): string` — `photo.jpg`, 4, `image/png` → `photo@4x.png`; nameless → `upscaled@4x.png`
  - `encodeImage(img: RasterImage, format: ExportFormat, quality: number): Promise<Blob>` — JPEG flattens alpha on white; returned `blob.type` may differ from `format` (Safari WebP)
  - `saveImage(blob: Blob, name: string): Promise<'saved' | 'cancelled'>`

- [ ] **Step 1: Write failing test**

`tests/exportImage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { exportName } from '../src/lib/exportImage'

describe('exportName', () => {
  it('replaces the extension and adds the scale', () => {
    expect(exportName('photo.final.jpg', 4, 'image/png')).toBe('photo.final@4x.png')
    expect(exportName('a.png', 2, 'image/jpeg')).toBe('a@2x.jpg')
    expect(exportName('a.png', 2, 'image/webp')).toBe('a@2x.webp')
  })
  it('names a pasted (nameless) image', () => {
    expect(exportName(undefined, 4, 'image/png')).toBe('upscaled@4x.png')
    expect(exportName('', 4, 'image/png')).toBe('upscaled@4x.png')
  })
  it('uses the ACTUAL blob type, so a Safari WebP→PNG fallback gets .png', () => {
    const actual = 'image/png' // what convertToBlob returned for a webp request
    expect(exportName('a.png', 4, actual)).toBe('a@4x.png')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/exportImage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/exportImage.ts`**

```ts
import type { RasterImage } from '../types'

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

/** Pass the encoded blob's type, not the requested one: Safari returns PNG for a WebP request. */
export function exportName(sourceName: string | undefined, scale: number, mime: string): string {
  const base = (sourceName ?? '').replace(/\.[^./\\]*$/, '').trim() || 'upscaled'
  return `${base}@${scale}x.${EXT[mime] ?? 'png'}`
}

export async function encodeImage(
  img: RasterImage,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const pixels = new OffscreenCanvas(img.width, img.height)
  pixels.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
  if (format !== 'image/jpeg') return pixels.convertToBlob({ type: format, quality })
  // JPEG has no alpha and browsers flatten onto black; flatten onto white instead.
  const flat = new OffscreenCanvas(img.width, img.height)
  const ctx = flat.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, img.width, img.height)
  ctx.drawImage(pixels, 0, 0)
  return flat.convertToBlob({ type: format, quality })
}
```

- [ ] **Step 4: Copy `share.ts`, write `saveFile.ts`**

```bash
cp ../slop-vectorizer/src/lib/share.ts src/lib/
```

`src/lib/saveFile.ts` (reduced from the vectorizer's: no handle reuse, no project files):
```ts
/** Saving the result. Chromium: save picker. iPhone/iPad: share sheet (Save to Files).
 *  Elsewhere, or when the share sheet can't open: a plain download. */
import { canShareFile, saveToFilesAvailable, shareFile } from './share'

declare global {
  interface Window {
    showSaveFilePicker?: (opts: {
      suggestedName: string
      types: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<FileSystemFileHandle>
  }
}

// iPad can cancel a download whose object URL is revoked too soon.
const REVOKE_DELAY_MS = 60_000

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

export async function saveImage(blob: Blob, name: string): Promise<'saved' | 'cancelled'> {
  if (window.showSaveFilePicker) {
    const ext = '.' + name.split('.').pop()
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'Image', accept: { [blob.type]: [ext] } }],
      })
      const w = await h.createWritable()
      await w.write(blob)
      await w.close()
      return 'saved'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      throw err
    }
  }
  const file = new File([blob], name, { type: blob.type })
  if (saveToFilesAvailable() && canShareFile(file)) {
    const r = await shareFile(file)
    if (r.outcome === 'shared') return 'saved'
    if (r.outcome === 'dismissed') return 'cancelled'
    // 'needs-tap' (encoding outlasted the tap) or 'failed': fall through to a download.
  }
  downloadBlob(blob, name)
  return 'saved'
}
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run check`
Expected: PASS; clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/exportImage.ts src/lib/share.ts src/lib/saveFile.ts tests/exportImage.test.ts
git commit -m "feat: PNG/JPEG/WebP export with white JPEG flattening and save paths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Controls panel, dropzone and App integration

**Files:**
- Create: `src/lib/Dropzone.svelte` (adapted), `src/lib/ControlsPanel.svelte`
- Modify: `src/App.svelte` (replace placeholder)

**Interfaces:**
- Consumes: everything above. `isAppleTouch` from `share.ts`; `fitInput`, `MAX_PIXELS_*` from `limits.ts`; `fileToRasterImage`, `resizeImage` from `decode.ts`; `UpscalerClient`, `UpscaleError`; `MODELS`, `MODEL_ORDER`, `DEFAULT_MODEL`; `encodeImage`, `exportName`, `saveImage`; `Viewport`; `CompareView`, `ImagePane`; `sliderFill`.
- Produces: the working app.

- [ ] **Step 1: Adapt the Dropzone**

```bash
cp ../slop-vectorizer/src/lib/Dropzone.svelte src/lib/
```
Edit: `accept="image/*"` (drop `.zip`), and the prompt text becomes `Drop an image here, click to browse, or paste from clipboard`.

- [ ] **Step 2: Write `src/lib/ControlsPanel.svelte`**

```svelte
<!-- src/lib/ControlsPanel.svelte -->
<script lang="ts">
  import { Columns2, SquareSplitHorizontal, Maximize, ImagePlus } from '@lucide/svelte'
  import type { Ep, ModelId, Scale } from '../types'
  import { MODELS, MODEL_ORDER } from './models'
  import type { ExportFormat } from './exportImage'
  import { sliderFill } from './sliderFill'

  let {
    modelId = $bindable(),
    scale = $bindable(),
    mode = $bindable(),
    format = $bindable(),
    quality = $bindable(),
    ep,
    running,
    hasResult,
    inputSize,
    saveNotice,
    onupscale,
    oncancel,
    onsave,
    onfit,
    onnew,
    onsettings,
  }: {
    modelId: ModelId
    scale: Scale
    mode: 'split' | 'side'
    format: ExportFormat
    quality: number
    ep: Ep | null
    running: boolean
    hasResult: boolean
    inputSize: { width: number; height: number }
    saveNotice: string | null
    onupscale: () => void
    oncancel: () => void
    onsave: () => void
    onfit: () => void
    onnew: () => void
    onsettings: () => void // model or scale changed: the old result no longer matches
  } = $props()

  const SCALES: Scale[] = [2, 4]
  const mb = (b: number) => `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB`
</script>

<div class="cp">
  <header class="top">
    <strong>slop-image-upscaler</strong>
    <button class="icon-btn" onclick={onnew} title="Open another image"><ImagePlus size={16} /></button>
  </header>

  <section>
    <h2 class="section-head">View</h2>
    <div class="body">
      <div class="icon-row">
        <button
          class="icon-btn"
          class:ui-on={mode === 'side'}
          aria-pressed={mode === 'side'}
          onclick={() => (mode = 'side')}
          title="Side by side"><Columns2 size={16} /></button
        >
        <button
          class="icon-btn"
          class:ui-on={mode === 'split'}
          aria-pressed={mode === 'split'}
          disabled={!hasResult}
          onclick={() => (mode = 'split')}
          title="Split"><SquareSplitHorizontal size={16} /></button
        >
        <button class="icon-btn" onclick={onfit} title="Fit"><Maximize size={16} /></button>
      </div>
    </div>
  </section>

  <section>
    <h2 class="section-head">Upscale</h2>
    <div class="body">
      <label class="select-row">
        <span class="name">Model</span>
        <select bind:value={modelId} onchange={onsettings} disabled={running}>
          {#each MODEL_ORDER as id (id)}
            <option value={id}>{MODELS[id].label} · {mb(MODELS[id].bytes)}</option>
          {/each}
        </select>
      </label>
      {#if MODELS[modelId].slowOnCpu && ep === 'wasm'}
        <p class="notice">Slow on CPU — this can take minutes per image.</p>
      {/if}
      <div class="select-row">
        <span class="name">Scale</span>
        <div class="icon-row">
          {#each SCALES as s (s)}
            <button
              class:ui-on={scale === s}
              aria-pressed={scale === s}
              disabled={running}
              onclick={() => {
                scale = s
                onsettings()
              }}>×{s}</button
            >
          {/each}
        </div>
      </div>
      <p class="hint">
        {inputSize.width}×{inputSize.height} → {inputSize.width * scale}×{inputSize.height * scale}
      </p>
      <div class="save-buttons">
        {#if running}
          <button class="grow" onclick={oncancel}>Cancel</button>
        {:else}
          <button class="btn-primary grow" onclick={onupscale}>Upscale</button>
        {/if}
      </div>
      {#if ep}
        <p class="hint">Running on {ep === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WebAssembly)'}</p>
      {/if}
    </div>
  </section>

  <section class="save">
    <label class="select-row">
      <span class="name">Format</span>
      <select bind:value={format}>
        <option value="image/png">PNG</option>
        <option value="image/jpeg">JPEG</option>
        <option value="image/webp">WebP</option>
      </select>
    </label>
    {#if format !== 'image/png'}
      <label class="slider-row">
        <span class="name">Quality</span>
        <input
          type="range"
          min="0.5"
          max="1"
          step="0.01"
          bind:value={quality}
          style={sliderFill(quality, 0.5, 1)}
        />
        <span class="value">{Math.round(quality * 100)}</span>
      </label>
    {/if}
    <div class="save-buttons">
      <button class="grow" disabled={!hasResult || running} onclick={onsave}>Save image</button>
    </div>
    {#if saveNotice}<p class="hint">{saveNotice}</p>{/if}
  </section>

  <footer>
    Real-ESRGAN models (BSD-3). Runs entirely in your browser — nothing is uploaded.
  </footer>
</div>

<style>
  .cp {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    font-size: 12px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 44px;
    padding: 0 12px;
    flex-shrink: 0;
  }
  .top strong {
    font-size: 14px;
    font-weight: 600;
  }
  .section-head {
    margin: 0;
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    background: var(--color-raised);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-muted);
    justify-content: space-between;
  }
  .body {
    padding: 8px 12px 12px;
  }
  .name {
    color: var(--color-muted);
    white-space: nowrap;
  }
  .select-row,
  .slider-row {
    display: grid;
    align-items: center;
    gap: 8px;
    min-height: var(--ctl-h);
    margin: 2px 0;
  }
  .select-row {
    grid-template-columns: 1fr auto;
  }
  .select-row select {
    max-width: 190px;
  }
  .slider-row {
    grid-template-columns: 76px minmax(0, 1fr) 32px;
  }
  .value {
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .icon-row {
    display: flex;
    gap: 4px;
  }
  .icon-btn {
    width: var(--ctl-h);
    padding: 0;
  }
  .save {
    padding: 12px;
    border-top: 1px solid var(--color-line);
  }
  .save-buttons {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .grow {
    flex: 1;
  }
  .hint {
    margin: 6px 0 0;
    color: var(--color-muted);
    font-size: 11px;
    overflow-wrap: anywhere;
  }
  .notice {
    margin: 0 0 4px;
    color: var(--color-warn);
  }
  footer {
    margin-top: auto;
    padding: 8px 12px;
    color: var(--color-muted);
    font-size: 11px;
  }
</style>
```

- [ ] **Step 3: Write `src/App.svelte`**

Layout, empty state, stage pill, drop overlay and toast styles are the vectorizer's (`../slop-vectorizer/src/App.svelte` lines 646–750, copied below with the unused `.open-project` rules dropped and a `.dialog` added).

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import type { Ep, ModelId, RasterImage, Scale, UpscaleProgress } from './types'
  import Dropzone from './lib/Dropzone.svelte'
  import ControlsPanel from './lib/ControlsPanel.svelte'
  import CompareView from './lib/CompareView.svelte'
  import ImagePane from './lib/ImagePane.svelte'
  import { Viewport } from './lib/viewport.svelte'
  import { fileToRasterImage, resizeImage } from './lib/decode'
  import { fitInput, MAX_PIXELS_APPLE_TOUCH, MAX_PIXELS_DESKTOP } from './lib/limits'
  import { isAppleTouch } from './lib/share'
  import { UpscalerClient, UpscaleError } from './lib/workerClient'
  import { DEFAULT_MODEL } from './lib/models'
  import { encodeImage, exportName, type ExportFormat } from './lib/exportImage'
  import { saveImage } from './lib/saveFile'

  const client = new UpscalerClient()
  const viewport = new Viewport()
  // ?cpu forces the WebAssembly path (manual QA of the fallback).
  const forceWasm = new URLSearchParams(location.search).has('cpu')
  const maxPixels = isAppleTouch(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
    ? MAX_PIXELS_APPLE_TOUCH
    : MAX_PIXELS_DESKTOP

  let original = $state<RasterImage | null>(null)
  let result = $state<RasterImage | null>(null)
  let sourceName = $state<string | undefined>(undefined)
  let modelId = $state<ModelId>(DEFAULT_MODEL)
  let scale = $state<Scale>(4)
  let mode = $state<'split' | 'side'>('side')
  let format = $state<ExportFormat>('image/png')
  let quality = $state(0.92)
  let ep = $state<Ep | null>(null)
  let running = $state(false)
  let stage = $state<string | null>(null)
  let error = $state<{ text: string; retry: boolean } | null>(null)
  let dropError = $state<string | null>(null)
  let saveNotice = $state<string | null>(null)
  let tooBig = $state<{ w: number; h: number } | null>(null)
  let dropping = $state(false)
  let viewsW = $state(0)
  let viewsH = $state(0)
  let imageInput: HTMLInputElement

  // View space = output pixels, known before the run so the panes don't jump when it lands.
  const viewW = $derived(original ? original.width * scale : 0)
  const viewH = $derived(original ? original.height * scale : 0)
  const twoColumn = $derived(mode === 'side' || !result)

  function fit() {
    const cw = twoColumn ? (viewsW - 2) / 2 : viewsW
    if (viewW && cw > 0) viewport.fitTo(cw, viewsH, viewW, viewH)
  }
  // Refit when the image, scale or layout changes, unless the user has zoomed/panned.
  $effect(() => {
    void [viewW, viewH, viewsW, viewsH, twoColumn]
    if (!viewport.touched) fit()
  })

  async function handleFile(file: File) {
    try {
      const img = await fileToRasterImage(file)
      if (running) cancel()
      original = img
      result = null
      sourceName = file.name
      error = dropError = saveNotice = null
      viewport.touched = false
      mode = 'side'
    } catch {
      dropError = "That file isn't an image this browser can open."
      if (original) error = { text: dropError, retry: false }
    }
  }

  function settingsChanged() {
    result = null
    mode = 'side'
    saveNotice = null
  }

  function upscale() {
    if (!original) return
    const f = fitInput(original.width, original.height, scale, maxPixels)
    if (!f.ok) {
      tooBig = { w: f.w, h: f.h }
      return
    }
    void run(original)
  }

  function acceptDownscale() {
    if (!original || !tooBig) return
    original = resizeImage(original, tooBig.w, tooBig.h)
    tooBig = null
    void run(original)
  }

  function describe(p: UpscaleProgress): string {
    if (p.phase === 'download')
      return p.total
        ? `Downloading model… ${Math.round((p.loaded / p.total) * 100)}%`
        : `Downloading model… ${(p.loaded / 1e6).toFixed(1)} MB`
    if (p.phase === 'init') return 'Starting model…'
    return `Upscaling… tile ${p.done}/${p.total}`
  }

  async function run(img: RasterImage) {
    running = true
    error = null
    saveNotice = null
    stage = 'Starting…'
    try {
      result = await client.upscale(
        img,
        modelId,
        scale,
        forceWasm,
        (p) => (stage = describe(p)),
        (e) => (ep = e),
      )
      mode = 'split'
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled') return
      if (err instanceof UpscaleError && err.kind === 'download')
        error = { text: "Couldn't download the model. Check your connection.", retry: true }
      else
        error = {
          text: `Upscaling failed (${err instanceof Error ? err.message : String(err)}). Try a smaller image or the General model.`,
          retry: false,
        }
    } finally {
      running = false
      stage = null
    }
  }

  function cancel() {
    client.cancel()
    running = false
    stage = null
  }

  async function save() {
    if (!result) return
    saveNotice = null
    try {
      const blob = await encodeImage(result, format, quality)
      if (blob.type !== format)
        saveNotice = `This browser can't encode ${format.split('/')[1].toUpperCase()}; saved as ${blob.type.split('/')[1].toUpperCase()}.`
      const outcome = await saveImage(blob, exportName(sourceName, scale, blob.type))
      if (outcome === 'saved' && !saveNotice) saveNotice = 'Saved.'
    } catch (err) {
      error = { text: `Save failed: ${err instanceof Error ? err.message : String(err)}`, retry: false }
    }
  }

  function windowDrop(e: DragEvent) {
    e.preventDefault()
    dropping = false
    const f = e.dataTransfer?.files?.[0]
    if (f) void handleFile(f)
  }
</script>

<svelte:window
  ondragover={(e) => {
    if (!original) return
    e.preventDefault()
    dropping = true
  }}
  ondragleave={(e) => {
    if (!e.relatedTarget) dropping = false
  }}
  ondrop={(e) => {
    if (original) windowDrop(e)
  }}
/>
<input
  type="file"
  accept="image/*"
  hidden
  bind:this={imageInput}
  onchange={() => {
    const f = imageInput.files?.[0]
    if (f) void handleFile(f)
    imageInput.value = ''
  }}
/>

{#if !original}
  <main class="empty">
    <div class="intro">
      <h1>slop-image-upscaler</h1>
      <p>
        Upscale photos and anime ×2 or ×4 with Real-ESRGAN, running on your GPU in the browser.
        Nothing is uploaded.
      </p>
      <Dropzone onfile={handleFile} error={dropError} />
    </div>
  </main>
{:else}
  <div class="app-grid">
    <div class="views" class:side={twoColumn} bind:clientWidth={viewsW} bind:clientHeight={viewsH}>
      {#if result && mode === 'split'}
        <CompareView {original} {result} {viewport} width={viewW} height={viewH} />
      {:else}
        <ImagePane image={original} label="Original" {viewport} width={viewW} height={viewH} pixelated />
        <ImagePane image={result} label="Upscaled" {viewport} width={viewW} height={viewH} />
      {/if}
      {#if stage}<span class="stage-pill">{stage}</span>{/if}
    </div>
    <aside class="panel">
      <ControlsPanel
        bind:modelId
        bind:scale
        bind:mode
        bind:format
        bind:quality
        {ep}
        {running}
        hasResult={!!result}
        inputSize={original}
        {saveNotice}
        onupscale={upscale}
        oncancel={cancel}
        onsave={save}
        onfit={() => {
          viewport.touched = false
          fit()
        }}
        onnew={() => imageInput.click()}
        onsettings={settingsChanged}
      />
    </aside>
  </div>
  {#if dropping}<div class="drop-overlay"><span>Drop to open</span></div>{/if}
  {#if error}
    <div class="toast" role="alert">
      {error.text}
      {#if error.retry}<button class="retry" onclick={upscale}>Retry</button>{/if}
      <button onclick={() => (error = null)} aria-label="Dismiss">×</button>
    </div>
  {/if}
  {#if tooBig}
    <div class="scrim">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="too-big-title">
        <h2 id="too-big-title">Image too large for ×{scale}</h2>
        <p>
          {original.width}×{original.height} would produce
          {original.width * scale}×{original.height * scale}. Downscale the input to
          {tooBig.w}×{tooBig.h} first?
        </p>
        <div class="actions">
          <button onclick={() => (tooBig = null)}>Cancel</button>
          <button class="btn-primary" onclick={acceptDownscale}>Downscale and upscale</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .app-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    grid-template-rows: minmax(0, 1fr);
    height: 100vh;
  }
  .views {
    display: grid;
    min-width: 0;
    position: relative;
    background: var(--color-ground);
  }
  .views.side {
    grid-template-columns: 1fr 1fr;
    gap: 2px;
  }
  .stage-pill {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    color: var(--color-muted);
    font-size: 12px;
    padding: 4px 12px;
    border-radius: 999px;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  .panel {
    overflow-y: auto;
    border-left: 1px solid var(--color-line);
    background: var(--color-panel);
  }
  .empty {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .intro {
    max-width: 440px;
    text-align: center;
  }
  .intro h1 {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 0.5rem;
  }
  .intro p {
    font-size: 14px;
    color: var(--color-muted);
    line-height: 1.55;
    margin: 0 0 1.5rem;
  }
  .drop-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 20%, transparent);
    pointer-events: none;
  }
  .drop-overlay span {
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    color: var(--color-text);
    font-size: 14px;
    padding: 8px 16px;
    border-radius: 999px;
  }
  .toast {
    position: fixed;
    bottom: 1rem;
    right: 316px;
    max-width: 360px;
    background: var(--color-panel);
    border: 1px solid var(--color-danger);
    color: var(--color-text);
    font-size: 12px;
    padding: 8px 12px;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.4);
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .toast button[aria-label='Dismiss'] {
    height: auto;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-muted);
    font-size: 16px;
  }
  .scrim {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 0.5);
  }
  .dialog {
    max-width: 380px;
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    border-radius: 8px;
    padding: 16px;
    font-size: 12px;
  }
  .dialog h2 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .dialog p {
    margin: 0 0 16px;
    color: var(--color-muted);
    line-height: 1.5;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
</style>
```

- [ ] **Step 4: Verify static checks**

Run: `npm run check && npm run lint && npm test && npm run build`
Expected: all clean. Fix any svelte-check errors in place (e.g. `ImagePane` prop names must match Task 8).

- [ ] **Step 5: Manual smoke in the browser**

Run `npm run dev`, open `http://localhost:5173` in Chrome:
1. Drop a ~500 px photo → both panes show it; Upscale (General, ×4) → pill shows download %, then tiles; view switches to split; divider drags; wheel zoom/pan stay synced.
2. Cancel during tiles → pill disappears; Upscale again works.
3. Switch model/scale → result clears.
4. Save as PNG, JPEG (transparent PNG input → white background), WebP.
5. Drop a 3000×3000 image with ×4 → too-large dialog → Downscale → result 8192×8192 max side.
6. Reload with `?cpu` → "Running on CPU (WebAssembly)".

- [ ] **Step 6: Commit**

```bash
git add src/App.svelte src/lib/ControlsPanel.svelte src/lib/Dropzone.svelte
git commit -m "feat: controls panel and app flow (upscale, cancel, size cap, save)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: README, credits, QA matrix, deploy

**Files:**
- Create: `README.md`, `LICENSE` (MIT, copy `../slop-vectorizer/LICENSE`)

- [ ] **Step 1: Write `README.md`**

```markdown
# slop-image-upscaler

Upscale photos and anime/illustrations ×2 or ×4 in the browser with Real-ESRGAN. Runs on your
GPU via WebGPU (WebAssembly fallback); nothing is uploaded.

## Develop

    npm install
    npm run dev          # http://localhost:5173  (?cpu forces the WebAssembly path)
    npm test && npm run check && npm run lint
    npm run deploy       # Cloudflare Workers static assets

## Models

| Model | Source | License |
|---|---|---|
| realesr-general-x4v3 | xinntao/Real-ESRGAN, exported by `tools/export_onnx.py` | BSD-3-Clause |
| RealESRGAN_x4plus_anime_6B | xinntao/Real-ESRGAN, exported by `tools/export_onnx.py` | BSD-3-Clause |
| RealESRGAN_x4plus | xinntao/Real-ESRGAN, ONNX from huggingface.co/SceneWorks/real-esrgan-onnx | BSD-3-Clause |

Re-export: `uv run tools/export_onnx.py export`.

Real-ESRGAN © 2021 Xintao Wang — BSD 3-Clause License, https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE

## License

MIT
```

(If Task 2 Step 3 failed and x4plus was self-exported, change that row's source accordingly.)

- [ ] **Step 2: Run the manual QA matrix and record it**

For each: Chrome (WebGPU), Chrome `?cpu`, Safari 26 (WebGPU; the user runs it), Safari `?cpu` — run one photo and one anime image through General, Anime and Photo (Photo on `?cpu` with a ≤256 px image only). Check seams at 400% zoom in split view. Append results to the spec's verification log as a table: browser/path × model → time, seams yes/no.

- [ ] **Step 3: Full verification**

Run: `npm test && npm run check && npm run lint && npm run format:check && npm run build && find dist -type f -size +24M`
Expected: all clean; `find` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add README.md LICENSE docs/superpowers/specs/2026-09-25-slop-image-upscaler-design.md
git commit -m "docs: README with model credits; QA verification log

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Deploy — ask first**

Deploying publishes to the user's Cloudflare account. Ask the user before running `npm run deploy`. After deploy, open the URL + check `crossOriginIsolated` is `true` in the console and upscale one image.
