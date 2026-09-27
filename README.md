# slop-image-upscaler

Client-side AI image upscaler. Drop a photo, an anime frame or an illustration and get it back
×2 or ×4 with [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN), running on your GPU through
WebGPU, with a WebAssembly fallback where WebGPU is missing.

**Live: <https://slop-image-upscaler.meigo.workers.dev/>**

Everything runs in your browser. Images are never uploaded anywhere: the models are downloaded
once, cached by the browser, and run locally in a Web Worker.

![slop-image-upscaler UI: a line drawing in split view, the pixelated original on the left of the divider and the clean ×4 anime-model result on the right, with the controls panel showing view toggles, model and scale pickers, the Upscale button and export format](docs/ui-screenshot.webp)

## Features

- **Three models:**
  - **General (fast)** — realesr-general-x4v3, 4.9 MB, the default
  - **Anime / illustration** — RealESRGAN_x4plus_anime_6B, 18 MB, desktop only
  - **Photo (high quality)** — RealESRGAN_x4plus, 67 MB, fetched from Hugging Face on first use,
    desktop only
- **×2 or ×4 output.** The models are ×4; ×2 is Lanczos-downscaled tile by tile with
  [pica](https://github.com/nodeca/pica).
- **Split and side-by-side compare views**, with zoom and pan kept in sync; wheel, drag and pinch
  all work. The original is drawn with sharp pixels so you see what the model started from.
- **Transparency preserved.** The alpha channel is carried through, and colour is filled in under
  transparent pixels so edges don't get a dark fringe.
- **Export** as PNG, JPEG (flattened onto white) or WebP, with a quality slider for the lossy
  formats.
- **Any size up to 8192 px** on the output's long side (16.7 MP on iPhone/iPad). Bigger inputs get
  an offer to downscale first.
- **Progress per tile, and cancel at any time.**

## Limitations

- **iPhone/iPad:** only the General model is offered. The Anime and Photo models are RRDB
  networks whose ×4 feature maps need more memory than iOS/iPadOS Safari allows a tab (the Anime
  model crashed an iPad tab); smaller tiles would fit but leave visible seams. Output there is
  also capped at 16.7 MP, Safari's canvas limit.
- **WebAssembly fallback:** much slower than WebGPU, especially for the Photo model.

## How it works

1. **Load:** the image is decoded to RGBA, keeping transparency.
2. **Tiling:** it is cut into tiles (512 px on WebGPU, 256 px on WebAssembly), each with a 16 px
   reflect-padded border so the model sees context across the seam.
3. **Inference:** each tile runs through the ONNX model in
   [onnxruntime-web](https://onnxruntime.ai/docs/tutorials/web/). The engine tries WebGPU first
   and falls back to WebAssembly. A GPU failure mid-run is retried once on the CPU.
4. **Stitch:** the padding (×scale) is trimmed off each output tile, and the tiles are pasted back
   together without seams.
5. **Alpha:** the alpha channel is enlarged separately with bilinear filtering and put back.

The multithreaded WebAssembly path needs a cross-origin-isolated page, so the site is served with
COOP/COEP headers (`public/_headers`). The runtime's own `.wasm` files load from jsDelivr, pinned
to the bundled version.

## Develop

    npm install
    npm run dev          # http://localhost:5173  (?cpu forces the WebAssembly path)
    npm test && npm run check && npm run lint
    npm run deploy       # Cloudflare Workers static assets

## Models

| Model                      | Source                                                                                                                                                                       | License      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| realesr-general-x4v3       | xinntao/Real-ESRGAN, exported by `tools/export_onnx.py`                                                                                                                      | BSD-3-Clause |
| RealESRGAN_x4plus_anime_6B | xinntao/Real-ESRGAN, exported by `tools/export_onnx.py`                                                                                                                      | BSD-3-Clause |
| RealESRGAN_x4plus          | xinntao/Real-ESRGAN, ONNX from [SceneWorks/real-esrgan-onnx](https://huggingface.co/SceneWorks/real-esrgan-onnx) (validated against PyTorch by `tools/export_onnx.py check`) | BSD-3-Clause |

Re-export: `uv run tools/export_onnx.py export`.

Real-ESRGAN © 2021 Xintao Wang — BSD 3-Clause License,
<https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE>

## License

[MIT](LICENSE)
