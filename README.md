# Free Image Upscaler

Client-side Real-ESRGAN image upscaler (×2 / ×4) for photos and anime. Runs in the browser with WebGPU and WASM—images never upload.

**Live:** [free-image-upscaler.web-free.site](https://free-image-upscaler.web-free.site)

Based on [slop-image-upscaler](https://github.com/meigo/slop-image-upscaler) (MIT) by meigo.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output: `dist/` (static assets for Cloudflare Workers). Post-build steps add prerendered SEO pages, sitemap, and the web-free.site footer block.

## Test

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).