# slop-image-upscaler — Design

Date: 2026-09-25
Status: approved design, pending spec review

## Goal

A simple, fully client-side image upscaler in the slop app family. User drops an
image, picks a model and scale, sees original vs upscaled in a synced split view,
and exports the result. No image ever leaves the browser.

**Content targets:** photos / general images, and anime / illustrations.
Pixel art is out of scope.

**Success criteria**

- A 512×512 image upscaled ×4 with the default model completes in the browser on
  Chrome and Safari 26 (WebGPU) and on the WASM fallback path.
- Output has no visible tile seams (verified by the tiling round-trip test).
- UI, styling and interaction match slop-vectorizer (same tokens, layout, compare view).
- Deployed as static assets on Cloudflare Workers.

## Decisions (with rejected alternatives)

| Decision | Chosen | Rejected & why |
|---|---|---|
| Where inference runs | Browser (Web Worker) | Server (Workers AI / Replicate / own GPU): costs money, uploads user images, not open |
| ML runtime | onnxruntime-web 1.30.x, WebGPU EP → WASM EP fallback | TF.js / UpscalerJS: TF.js unreleased since 2024-10. transformers.js: no tiling control |
| Hosting | Cloudflare Workers static assets | GitHub Pages: can't set COOP/COEP → single-threaded WASM fallback |
| Styling | Scoped CSS + tokens from slop-vectorizer `app.css` (SLOP-TIMELINE-UI palette), dark-only | Tailwind 4: would make porting vectorizer components harder |
| Non-native ×2 | Run ×4 model, then Lanczos-downscale each padded tile with `pica` before cropping (memory bounded by final output) | Whole-image ×4 then downscale: 4× the peak memory. Dedicated ×2 models: more files, marginal gain |

## Tech stack

Mirrors slop-vectorizer: Svelte 5 (no SvelteKit), Vite 8, TypeScript, vitest,
svelte-check, eslint, prettier, `@lucide/svelte`. Additions: `onnxruntime-web`,
`pica`, `wrangler` (deploy).

## Models

All models are fp32 ONNX (works on both WebGPU and WASM EPs), dynamic H/W, NCHW
float32 RGB input in [0,1], ×4 output.

| UI label | Model | License | Size | Hosted |
|---|---|---|---|---|
| General (fast) — default | realesr-general-x4v3 | BSD-3 | ~4.6 MB | `public/models/` (same origin) |
| Anime / illustration | RealESRGAN_x4plus_anime_6B | BSD-3 | ~18 MB | `public/models/` (same origin) |
| Photo (high quality) | RealESRGAN_x4plus | BSD-3 | ~67 MB | external (see below); labeled "slow on CPU" |

- `tools/export_onnx.py` exports general-x4v3 and anime_6B from the official
  xinntao/Real-ESRGAN weights (opset 17, dynamic axes). Exported `.onnx` files are
  committed. Third-party ONNX uploads are not trusted blindly.
- x4plus exceeds Cloudflare's 25 MiB per-asset limit. First validate
  `SceneWorks/real-esrgan-onnx` on Hugging Face (output matches PyTorch within
  tolerance on a test image). If it fails validation, self-export and host on
  Cloudflare R2 instead. Model URL lives in one config constant.
- Models are fetched with download progress and stored in Cache Storage
  (`modelCache.ts`); subsequent loads are offline.
- README credits Real-ESRGAN (BSD-3) with license text.

## Architecture

```
main thread (Svelte UI)                      upscale.worker.ts (module worker)
───────────────────────                      ─────────────────────────────────
Dropzone → decode.ts → RasterImage ──post (transfer)──▶ load model (modelCache)
ControlsPanel (model, scale, view, export)              create ORT session: webgpu → wasm
CompareView / ImagePane ◀──progress {tile i/n, ep}──    for each tile: pad → run → crop → paste
workerClient.ts (jobs, cancel) ◀──result (transfer)──   (×2: pica Lanczos downscale)
saveFile.ts ← OffscreenCanvas.convertToBlob
```

### Components

**Ported from slop-vectorizer (adapted):**

- `app.css` — tokens and global controls, unchanged.
- `lib/viewport.svelte.ts`, `lib/viewportMath.ts` — shared zoom/pan state, unchanged.
- `lib/CompareView.svelte` — `svg: string` prop replaced by `result: RasterImage`.
  Both layers are canvases in the result's pixel space; the original canvas is
  CSS-scaled by `result.width / original.width` with `image-rendering: pixelated`
  so both align. Circle gizmo code removed.
- `lib/ImagePane.svelte` — side-by-side mode, sharing one viewport.
- `lib/Dropzone.svelte`, `lib/decode.ts` — drop/browse/paste; decode to
  `RasterImage`. Preserve alpha (do not flatten on white as the vectorizer does).
- `lib/saveFile.ts` — share sheet (iOS) / `showSaveFilePicker` / `<a download>`.

**New:**

- `lib/ControlsPanel.svelte` — model picker, scale (×2/×4), view mode
  (split/side), export format (PNG / JPEG / WebP) + quality slider (lossy only),
  Upscale / Cancel buttons, EP indicator ("GPU" / "CPU").
- `lib/models.ts` — model registry: id, label, URL, size, `slowOnCpu` flag.
- `lib/modelCache.ts` — fetch-with-progress + Cache Storage get/put.
- `lib/tiling.ts` — pure functions:
  - `planTiles(w, h, tile, pad)` → list of `{x, y, w, h}` core rects covering the image.
  - `extractTile(img, rect, pad)` → padded tile with reflect padding at image edges.
  - `pasteTile(out, tileOut, rect, pad, scale)` → crop `pad × scale` border, write core.
- `lib/workerClient.ts` — job ids, stale-result dropping, cancel = terminate +
  respawn (same pattern as vectorizer).
- `worker/upscale.worker.ts` — session creation with EP fallback, tile loop,
  progress messages, ×2 downscale via pica.
- `App.svelte` — state, `1fr 300px` grid, empty state → Dropzone, stage pill for
  progress, drop overlay.

### Alpha handling

Models are RGB. Alpha channel is upscaled separately with bilinear resize and
re-attached. Images without alpha skip this.

### Tiling parameters

- Tile core: 512 px on WebGPU, 256 px on WASM. Pad: 16 px (reflect at image edges).
- Output tiles are cropped by `16 × 4` px per side before pasting; no feather blending
  (add only if seams are visible in manual testing).

### ORT configuration

- `onnxruntime-web` WASM binaries loaded from jsDelivr, version pinned to the
  installed package version (`ort.env.wasm.wasmPaths`); the WebGPU `.wasm` (~28 MB)
  exceeds Cloudflare's 25 MiB per-asset limit.
- `ort.env.wasm.numThreads = navigator.hardwareConcurrency` when
  `crossOriginIsolated`, else 1.

### Headers

`public/_headers`:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

**Risk:** jsDelivr and Hugging Face must be loadable under COEP. First
implementation task verifies this in Chrome and Safari. Fallback order:
(1) `Cross-Origin-Embedder-Policy: credentialless` (not supported in all Safari
versions), (2) drop COOP/COEP entirely (WASM goes single-threaded; WebGPU unaffected).

## Limits and error handling

| Situation | Behavior |
|---|---|
| Output longest side > 8192 px, or output area > 8192² (desktop) / 16,777,216 px (iPhone/iPad Safari canvas limit) | Before running: dialog offering to downscale the input to fit, or cancel |
| WebGPU unavailable or session creation fails | Retry on WASM EP; indicator shows "CPU" |
| Model download fails | Inline error with Retry button |
| Out-of-memory / ORT runtime error | Error message suggesting a smaller image or the General model |
| x4plus selected on WASM | Warning label "slow on CPU" next to the option (not blocked) |
| Unsupported / undecodable file | Dropzone error message (existing vectorizer behavior) |
| User cancels | Worker terminated and respawned; UI returns to pre-run state |

## Testing

**vitest (unit):**

- `planTiles`: 1×1 image, image smaller than a tile, sizes not multiple of tile,
  exact multiples; tiles cover every pixel exactly once.
- `extractTile`: reflect padding correct at all four edges and corners.
- Round trip: split → fake model (nearest-neighbour ×4) → stitch equals
  whole-image nearest ×4, pixel-exact. Proves no seams/off-by-one.
- Output size cap / downscale-to-fit computation.
- Alpha split/recombine preserves alpha dimensions.

**Model validation (one-off, `tools/`):** exported ONNX output vs PyTorch output on
a sample image, max abs diff under 1e-3.

**Manual:** Chrome + Safari 26, WebGPU and forced-WASM, one photo and one anime
image per model; check seams at 400% zoom, export in all three formats.

## Out of scope (v1)

Batch processing / zip export, denoise-strength control (general-x4v3 `dni`),
pixel-art scalers, persistence/autosave, project files, light theme.

## Verification log (Task 3)

general-x4v3, one 64×64 tile, onnxruntime-web 1.30.0 (WASM binaries from jsDelivr).

| Browser | Server | isolated | webgpu ms (64²) | wasm ms (64²) | HF fetch | COEP value used |
|---|---|---|---|---|---|---|
| Chrome (macOS) | vite dev | true | 380 | 1423 | ok | require-corp |
| Chrome (macOS) | wrangler dev (dist + _headers) | true | 245 | 1348 | ok | require-corp |
| Safari 26 | deployed site | works (confirmed by the user, 2026-09-25) | | | | require-corp |

Findings: the WebGPU build uses `ort-wasm-simd-threaded.asyncify.wasm` (26.8 MB); Vite emits it into
`dist/assets`, so `public/.assetsignore` (`*.wasm`) keeps it out of the deploy. ORT still loads it
from jsDelivr at runtime.

## QA log (Task 11)

Chrome 2026-09 on macOS (Apple Silicon), vite dev. Synthetic test images (`temp/qa/`, not committed).

| Path | Model | Input → output | Time | Seams | Notes |
|---|---|---|---|---|---|
| WebGPU | General | 320×240 → 1280×960 (×4) | 1.2 s | n/a (1 tile) | |
| WebGPU | General | 320×240 → 640×480 (×2) | 1.0 s | n/a | pica Lanczos per tile |
| WebGPU | General | 2048×2048 → 8192×8192 | 5.9 s | none visible | after size-cap dialog; cancel + rerun OK |
| WebGPU | Anime | 96×96 RGBA → 384×384 | 0.3 s | n/a | alpha preserved |
| WebGPU | Photo | 320×240 → 1280×960 | 5.0 s | n/a | incl. 67 MB HF download; cached after |
| WASM (`?cpu`) | General | 320×240 → 1280×960 | 0.8 s | none: boundary column diff 1.40 vs neighbours 1.33–1.55 | 2 tiles |
| Safari 26 | all | — | — | — | works (confirmed by the user, 2026-09-25) |
| iPad Safari 26 | General | — | — | — | works, incl. Save to Files via share sheet (user, 2026-09-25) |
| iPad Safari 26 | Anime | — | — | — | crashed the tab (RRDB ×4 feature maps ≈1.2 GB per 512px tile) → Anime/Photo disabled on iPhone/iPad |

Export (Chrome): PNG/WebP keep alpha; JPEG flattens onto white. Filenames `name@4x.ext`.
