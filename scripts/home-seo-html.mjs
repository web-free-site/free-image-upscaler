#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/home-seo.json"), "utf8"));
const HUB = "https://web-free.site/?ref=image-upscaler";

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Static HTML for prerender and word-count checks (no H1 — live app supplies the single page H1). */
export function buildHomeSeoBodyHtml() {
  const steps = data.steps.map((t, i) => `<li><strong>Step ${i + 1}.</strong> ${esc(t)}</li>`).join("");
  const cases = data.useCases.map((t) => `<li>${esc(t)}</li>`).join("");
  const faq = data.faq
    .map(
      (item) =>
        `<div class="home-seo-faq-item"><h3>${esc(item.q)}</h3><p>${esc(item.a)}</p></div>`,
    )
    .join("");

  return `<section id="home-seo" class="home-seo" aria-labelledby="home-seo-title">
<h2 id="home-seo-title">About this free AI image upscaler</h2>
<p><strong>Free Image Upscaler</strong> enlarges JPEG, PNG, WebP, and HEIC photos ×2 or ×4 using Real-ESRGAN super-resolution models that run completely inside your browser. Unlike cloud upscalers that send your picture to a remote server, this tool keeps every pixel on your machine: you pick a file from disk, the ONNX runtime loads the model from this site, and inference happens in a Web Worker with WebGPU or WebAssembly.</p>
<p>That design matters for privacy, speed on good hardware, and predictable cost: there is no account, no API key, and no per-image fee. You get a practical photo enlarger and anime upscaler in one page, with a split or side-by-side compare view so you can judge faces, hair, and fine text before you download.</p>
<h2>How to upscale an image in five steps</h2>
<ol class="home-seo-steps">${steps}</ol>
<p>If you are new to super-resolution, read our <a href="${data.guideUrl}">hub guide to upscaling in the browser</a> or the on-site walkthrough at <a href="/how-to-upscale-an-image-in-the-browser">how to upscale an image in the browser</a>. For print sizing, see <a href="/upscale-a-photo-for-print">upscale a photo for print</a>; for soft originals, try <a href="/enhance-a-blurry-photo">enhance a blurry photo</a>.</p>
<h2>Privacy and in-browser processing</h2>
<p>We do not receive, store, or analyze your images on a backend. Model weights and runtime code download to your browser cache like any other static asset, but your creative work stays local. You can use the tool offline after models are cached, subject to browser storage limits. Because processing uses your CPU or GPU, very large outputs may take longer on older phones; the app can suggest downscaling an oversized input before a ×4 run so you stay within safe memory limits.</p>
<h2>Common use cases</h2>
<ul class="home-seo-uses">${cases}</ul>
<p>Real-ESRGAN adds plausible detail—it cannot invent perfect focus from extreme blur—but it is a strong last step before layout, thumbnails, or print orders when your source file is only slightly too small.</p>
<h2 id="home-seo-faq">Frequently asked questions</h2>
<div class="home-seo-faq">${faq}</div>
<p class="home-seo-hub">Explore more utilities on <a href="${HUB}">web-free.site</a> or follow the step-by-step <a href="${data.guideUrl}">Free Image Upscaler guide</a> on the hub.</p>
</section>`;
}

export function homeFaqForJsonLd() {
  return data.faq;
}

export function homeGuideUrl() {
  return data.guideUrl;
}