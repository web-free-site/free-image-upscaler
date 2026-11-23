# Cursor agent brief — free-image-upscaler

Target: https://free-image-upscaler.web-free.site
Repo name (wrangler `name`): `free-image-upscaler`
English name: "Free Image Upscaler". English primary.

Follow every rule in the attached `agent-brief-common.md`, with one SEO override below. Do not write the tool from scratch. Do not deploy. Do not switch models. Push to `main` of this repo when the work is done.

**SEO / language override (takes precedence over the common brief):** do **not** add a French or Swahili landing page, UI translation, or how-to pages. How-to and legal pages are English only. You may omit `hreflang` fr.

This is a **local-file** AI image upscaler (×2 / ×4) that runs in the browser. Do not upload images. Do not call a paid upscaling API.

## Recommended base (use this)

- Repo: https://github.com/meigo/slop-image-upscaler
- License: MIT (keep `LICENSE`, credit slop-image-upscaler / meigo in the footer and on `/about`)
- Stars: 1
- Last commit: 27 Sep 2026, 20:11 Africa/Kigali — `8440bb1686` on `main`
- Official demo: `https://slop-image-upscaler.meigo.workers.dev/`
- Stack: Vite, Svelte 5, TypeScript, `onnxruntime-web`, `pica`. A complete client-side Real-ESRGAN app: WebGPU with WASM fallback, Web Worker, split / side-by-side compare, ×2 / ×4. Models already in the repo: `realesr-general-x4v3.onnx` (~4.9 MiB) and `realesrgan-x4plus-anime-6b.onnx` (~18 MiB), both under the 25 MiB Cloudflare file cap. A third 67 MiB photo model is fetched from Hugging Face on first use — **do not commit that file, and do not put it in Worker assets**. `npm run build` emits a static `dist/`. The repo already has a wrangler deploy script: **do not use it**, and do not put `account_id` in the committed `wrangler.toml`.
- Cloudflare: yes — it already targets Workers. You must add prerendered HTML for every public page (no bare SPA fallback).
- Verification (this box, 23 Nov 2026, Africa/Kigali): GitHub API. `LICENSE` is a real MIT file (Copyright (c) 2026 meigo). `package.json` license is MIT. Model sizes confirmed from the git tree.
- Why this one: MIT with a real `LICENSE` file, a complete working website (not just UpscalerJS the library), Real-ESRGAN ×2/×4, and models that fit the asset cap (except the optional 67 MiB one, which must stay a runtime fetch).

## Backup (MIT; UpscalerJS + ESRGAN-slim)

- Repo: https://github.com/asilgumus/resolution-increaser
- License: MIT (LICENSE file, Copyright (c) 2026 Asil Doğan Gümüş)
- Stars: 0
- Last commit: 6 Nov 2026, 19:39 Africa/Kigali — `ee5ef5035c` on `main`
- Stack: Vite, TypeScript, UpscalerJS 1.0.0, TensorFlow.js, WebGPU / WASM backends, bundled slim ×2 / ×4 models (~0.9 MiB each). Complete website, smaller models. UI is Turkish in the README — rebrand to English if you use this base.

`thekevinscott/UpscalerJS` is MIT (905 stars) but it is a **library**, not a site. Do not import the whole monorepo as the app.

## Do not use these

- `upscayl/upscayl` and other desktop / Electron upscalers.
- Any SaaS upscaler or repo that sends the image to a server.
- Repos without a license.

## Model / asset rules

- Do not put a 25+ MiB file in the Worker assets or the Git repo. The 67 MiB RealESRGAN_x4plus model may only be loaded at runtime (CDN or Hugging Face), with a progress indicator and browser cache, or dropped entirely if that is cleaner.
- Rebrand completely: the public name is "Free Image Upscaler". Do not keep the word "slop" in the UI, titles, wrangler `name`, or domain-facing text.
- No COEP/COOP headers.

## What to build on top of meigo/slop-image-upscaler

1. Import the base into this repo, keep the MIT license, and credit slop-image-upscaler / meigo, Real-ESRGAN, and onnxruntime-web. Omit GitHub Actions workflows if any (the token lacks the `workflow` scope — do not restore them).
2. Rebrand to "Free Image Upscaler". English primary. No FR/SW translations of the site. Keep ×2 / ×4, at least one general photo model and the anime/illustration model if it stays under the asset cap, and the before/after compare UI.
3. Keep everything 100% in the browser. No accounts, no paid APIs, no API keys, no file upload. Accept common local images (JPEG, PNG, WebP, and HEIC if easy). Let the user download the upscaled image (PNG/JPEG).
4. Adsterra only, never AdSense. Use **only** the placeholder keys in this brief (or real keys if a follow-up provides them). Follow the `free-invoice-generator` pattern: all 10 units, banners in isolated iframes, `public/ads.json`. Never set COEP/COOP headers. Ads must not break upscaling or download.
5. SEO: prerendered HTML for every page (no bare SPA fallback); unique title, meta description, canonical, OG; JSON-LD (WebApplication + FAQPage); `sitemap.xml` and `robots.txt` for `https://free-image-upscaler.web-free.site`; English how-to pages, at least `/how-to-upscale-an-image-in-the-browser`, `/upscale-a-photo-for-print`, and `/enhance-a-blurry-photo` (each with its own title, description and canonical); prerendered `/privacy`, `/terms`, `/about`, `/contact`. Canonicals must be `https://free-image-upscaler.web-free.site`. No French landing page.
6. Footer: credit the upstream project and the models, and add a link back to the hub `https://web-free.site/?ref=image-upscaler`.
7. On every prerendered HTML page, before `</body>`, add the More free tools block and the Cloudflare Web Analytics beacon (see below). Implement this with `scripts/inject-more-tools.mjs` hooked into `postbuild` or the end of `npm run build`, so a later rebuild cannot drop the home-page snippets. Do not rely on a one-off manual edit of `dist/` / `out/`.
   - The same **"More free tools"** block used on the other web-free.site tools (`id="wf-more-tools"`). Include a "Guides on this site" column for the how-to pages. List every current hub tool, plus the six other sites in this batch. Show **Free Image Upscaler** as bold text, not a self-link. Every outbound tool/hub link must carry `?ref=image-upscaler`.
     - **Documents & writing:** Free Word Counter (`https://free-word-counter.web-free.site/?ref=image-upscaler`), Free PDF Converter (`https://free-pdf-converter.web-free.site/?ref=image-upscaler`), Free CV Maker (`https://free-cv-maker.web-free.site/?ref=image-upscaler`), Free Invoice Generator (`https://free-invoice-generator.web-free.site/?ref=image-upscaler`), Free Typing Test (`https://free-typing-test.web-free.site/?ref=image-upscaler`), Free Signature Generator (`https://free-signature-generator.web-free.site/?ref=image-upscaler`), Free Email Signature Generator (`https://free-email-signature-generator.web-free.site/?ref=image-upscaler`).
     - **Images & codes:** Free QR Code Creator (`https://free-qr-code-creator.web-free.site/?ref=image-upscaler`), Free Image Resizer (`https://free-image-resizer.web-free.site/?ref=image-upscaler`), Free Image to Text (`https://free-image-to-text.web-free.site/?ref=image-upscaler`), Free Background Remover (`https://free-background-remover.web-free.site/?ref=image-upscaler`), Free Image Compressor (`https://free-image-compressor.web-free.site/?ref=image-upscaler`), Free HEIC to JPG Converter (`https://free-heic-to-jpg.web-free.site/?ref=image-upscaler`), **Free Image Upscaler**, Free Passport Photo Maker (`https://free-passport-photo-maker.web-free.site/?ref=image-upscaler`), Free PNG to SVG Converter (`https://free-png-to-svg.web-free.site/?ref=image-upscaler`).
     - **Calculators & currency:** Free Online Calculator (`https://free-online-calculator.web-free.site/?ref=image-upscaler`), Free Currency Converter (`https://free-currency-converter.web-free.site/?ref=image-upscaler`), Free Unit Converter (`https://free-unit-converter.web-free.site/?ref=image-upscaler`), Free Loan Calculator (`https://free-loan-calculator.web-free.site/?ref=image-upscaler`), Free Age Calculator (`https://free-age-calculator.web-free.site/?ref=image-upscaler`), Free Percentage Calculator (`https://free-percentage-calculator.web-free.site/?ref=image-upscaler`), Free BMI Calculator (`https://free-bmi-calculator.web-free.site/?ref=image-upscaler`).
     - **Text & SEO:** Free AI Humanizer (`https://free-ai-humanizer.web-free.site/?ref=image-upscaler`), Free SEO Generator (`https://free-seo-generator.web-free.site/?ref=image-upscaler`), Free Backlink Generator (`https://free-backlink-generator.web-free.site/?ref=image-upscaler`), Free JSON Formatter (`https://free-json-formatter.web-free.site/?ref=image-upscaler`), Free Text to Speech (`https://free-text-to-speech.web-free.site/?ref=image-upscaler`), Free Speech to Text (`https://free-speech-to-text.web-free.site/?ref=image-upscaler`), Free Diff Checker (`https://free-diff-checker.web-free.site/?ref=image-upscaler`).
     - **Audio & video:** Free Video to MP3 Converter (`https://free-video-to-mp3.web-free.site/?ref=image-upscaler`), Free MP3 Cutter (`https://free-mp3-cutter.web-free.site/?ref=image-upscaler`), Free Screen Recorder (`https://free-screen-recorder.web-free.site/?ref=image-upscaler`), Free Video Compressor (`https://free-video-compressor.web-free.site/?ref=image-upscaler`), Free Video to GIF Converter (`https://free-video-to-gif.web-free.site/?ref=image-upscaler`), Free Audio Converter (`https://free-audio-converter.web-free.site/?ref=image-upscaler`).
     - **Files:** Free ZIP Tool (`https://free-zip-tool.web-free.site/?ref=image-upscaler`).
     - **Test data:** Free Fake Address Generator (`https://free-fake-address-generator.web-free.site/?ref=image-upscaler`), Free Fake Name Generator (`https://free-fake-name-generator.web-free.site/?ref=image-upscaler`).
     - **Security & passwords:** Free Password Generator (`https://free-password-generator.web-free.site/?ref=image-upscaler`).
   - The same Cloudflare Web Analytics tag used on the other sites: `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "3e2f5f96ab32442ebb6e6f650615b58a"}'></script><!-- End Cloudflare Web Analytics -->`
8. `wrangler.toml`: `name = "free-image-upscaler"`, `[assets]` pointing at the static build output (`dist` or `out`). Use `html_handling = "auto-trailing-slash"` and `not_found_handling = "none"`. Custom domain `free-image-upscaler.web-free.site`. **Do not put `account_id` (or API tokens) in the committed file.** **Do not deploy.** Push to this repo only. Deploy happens from Gentil's box. Add a `.assetsignore` so Worker assets do not publish `AGENT_BRIEF.md`, `wrangler.toml`, `package.json`, `package-lock.json`, `.git/`, `node_modules/`, or other source/config files.
9. Test: production build, run locally (without COEP/COOP), upscale a small photo ×2 and ×4, download the result, check mobile at 390px, confirm no file is uploaded, fix bugs. Critique your own result and fix issues.
10. Push everything to `main`. Final report: base repo + license, which models you actually shipped (source, license, size, how they are loaded), pages, tests and results, remaining caveats, commit hash.

## Adsterra ad codes

Real Adsterra codes were not ready when this brief was written (the publisher-dashboard collection was stopped mid-run on an earlier attempt). **Do not invent real-looking keys.** Wire all 10 units and `public/ads.json` with the exact placeholder strings below (32 characters each, prefix `wf23placeholder0`). A later swap (or a follow-up to you with real keys) will replace them before deploy.

Code formats (KEY = the 32-char placeholder, later a 32-hex hash):
- Popunder: <script data-cfasync="false" src="https://abscloud.org/1/KEY"></script>
- Native Banner: <script async="async" data-cfasync="false" src="https://bauval.org/21/KEY"></script><div id="container-KEY"></div>
- Social Bar: <script data-cfasync="false" src="https://bauval.org/14/KEY"></script>
- Banner WxH: <script>atOptions = {'key':'KEY','format':'iframe','height':H,'width':W,'params':{}};</script><script src="https://bauval.org/22/KEY"></script>
- Smartlink URL: https://araplhn.org/4/KEY

## free-image-upscaler.web-free.site — site ID SITE_ID_PENDING
Popunder wf23placeholder0popunder00000000
Native Banner wf23placeholder0nativebanner0000
Smartlink wf23placeholder0smartlink0000000
Social Bar wf23placeholder0socialbar0000000
468x60 wf23placeholder0banner468x600000
160x300 wf23placeholder0banner160x300000
320x50 wf23placeholder0banner320x500000
300x250 wf23placeholder0banner300x250000
160x600 wf23placeholder0banner160x600000
728x90 wf23placeholder0banner728x900000


---
NOTE: any /workspace/... box path mentioned above is NOT accessible to you; everything you need is inline below. Clone the base repo from GitHub yourself.

# COMMON RULES (contents of agent-brief-common.md)
COMMON RULES (from Gentil, mandatory):
- Start from an existing, usable open-source repository: search GitHub, then compare stars, activity, license (MIT/Apache/BSD preferred; avoid AGPL/GPL unless nothing else fits) and code quality. Import its code into this repo, keep its LICENSE, and credit it in the footer and on /about.
- Do NOT write the tool from scratch. If no suitable open-source base exists, STOP before coding and report the 2-3 best candidates and why they fail. Gentil must approve any from-scratch work, and he only allows it for one or two simple pages.
- Keep the model you were launched with. Do not switch models.
- Must be hostable on Cloudflare Workers with static assets (free plan). No paid APIs, no server costs, no API keys. Client-side processing preferred.
- Monetization: Adsterra only, never AdSense. This brief ships obviously fake placeholder keys (the `wf23placeholder0…` strings). Wire all 10 units with those exact strings so they can be swapped later. Do not invent real-looking 32-hex Adsterra keys, URLs, or site IDs. If this prompt (or a later follow-up) includes a filled "ADSTERRA CODES FOR THIS SITE" section with real 32-hex keys, use those instead of the placeholders. Integrate all 10 units following the free-invoice-generator pattern: Popunder and Social Bar in the HTML; 728x90 at the top; sidebar 160x600 and 160x300; mid-page 728x90, 468x60 and Native; 300x250; sticky 320x50 on mobile; Smartlink as a discreet link. Banners go in isolated iframes with atOptions {key, format:'iframe', height, width, params:{}} and src https://bauval.org/22/<key>. Also write public/ads.json with all the codes. Never set COEP/COOP headers. Ads must not break the tool.
- SEO: prerendered HTML for every page (no bare SPA fallback); unique title, meta description, canonical and OG tags; JSON-LD (WebApplication + FAQPage); a long-tail keyword page or two; FAQ and how-to content; /privacy, /terms, /about and /contact pages (prerendered). The site-specific brief may override hreflang / French landing pages.
- Name: "Free <Tool>". English primary.
- Hook a `scripts/inject-more-tools.mjs` (or equivalent) into `postbuild` or the end of `npm run build`, so the Cloudflare Web Analytics beacon and the "More free tools" block are injected into every built HTML page and cannot be dropped by a later rebuild.
- Add wrangler.toml with name = <repo name> and [assets] pointing to the build output. Do NOT deploy: Gentil's box deploys it.
- Test: build, run it locally, exercise the main feature in a browser, check mobile at 390px, and fix bugs. Critique your own result and fix the issues you find.
- Push everything to main of this repo.
- Final report: the base repo and its license, the pages, the tests and their results, the remaining caveats, and the commit hash.

# ADSTERRA CODES FOR THIS SITE (use only these)
- Popunder: <script data-cfasync="false" src="https://abscloud.org/1/KEY"></script>
- Native Banner: <script async="async" data-cfasync="false" src="https://bauval.org/21/KEY"></script><div id="container-KEY"></div>
- Social Bar: <script data-cfasync="false" src="https://bauval.org/14/KEY"></script>
- Banner WxH: <script>atOptions = {'key':'KEY','format':'iframe','height':H,'width':W,'params':{}};</script><script src="https://bauval.org/22/KEY"></script>
- Smartlink URL: https://araplhn.org/4/KEY

## free-image-upscaler.web-free.site — site ID SITE_ID_PENDING
Popunder wf23placeholder0popunder00000000
Native Banner wf23placeholder0nativebanner0000
Smartlink wf23placeholder0smartlink0000000
Social Bar wf23placeholder0socialbar0000000
468x60 wf23placeholder0banner468x600000
160x300 wf23placeholder0banner160x300000
320x50 wf23placeholder0banner320x500000
300x250 wf23placeholder0banner300x250000
160x600 wf23placeholder0banner160x600000
728x90 wf23placeholder0banner728x900000
