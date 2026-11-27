#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildHomeSeoBodyHtml, homeFaqForJsonLd } from "./home-seo-html.mjs";

const HOST = "https://free-image-upscaler.web-free.site";
const SITE_NAME = "Free Image Upscaler";
const HUB = "https://web-free.site/?ref=image-upscaler";
const dist = path.resolve("dist");
const indexPath = path.join(dist, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("prerender-seo: missing", indexPath, "— run vite build first");
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexPath, "utf8");

const homeFaq = homeFaqForJsonLd();

const pages = [
  {
    path: "/how-to-upscale-an-image-in-the-browser",
    title: "How to upscale an image in the browser — Free Image Upscaler",
    description:
      "Step-by-step guide to upscaling photos ×2 or ×4 in your browser with Real-ESRGAN. No upload, no account.",
    h1: "How to upscale an image in the browser",
    snippet: `<p>Use <strong>${SITE_NAME}</strong> to enlarge a photo without sending it to a server. Open the home page, choose an image from your device, pick a Real-ESRGAN model (general photo or anime), and select ×2 or ×4 scale.</p>
<p>Wait for the model to load once per session, then compare the original and upscaled result with the split view. When you are happy with the detail, download PNG or JPEG. All inference runs locally via WebGPU or WASM.</p>
<p>Need print-sized pixels? See <a href="/upscale-a-photo-for-print">upscale a photo for print</a> or <a href="/enhance-a-blurry-photo">enhance a blurry photo</a>.</p>`,
  },
  {
    path: "/upscale-a-photo-for-print",
    title: "Upscale a photo for print — resolution guide | Free Image Upscaler",
    description:
      "Learn how many pixels you need for print and how to upscale a photo ×2 or ×4 in the browser before ordering prints.",
    h1: "Upscale a photo for print",
    snippet: `<p>Print shops often want 300 DPI at the physical size you order. If your file is too small, upscaling adds pixels so edges and text look sharper on paper—not magic, but a useful boost before layout.</p>
<p>Check your image width and height in pixels, estimate the largest print size at 300 DPI (width ÷ 300 = inches), then use ${SITE_NAME} at ×2 or ×4 if you need more resolution. Always preview on screen before paying for a large print.</p>
<p>For soft or noisy originals, combine upscaling with a cleaner source scan when possible; see <a href="/enhance-a-blurry-photo">enhance a blurry photo</a>.</p>`,
  },
  {
    path: "/enhance-a-blurry-photo",
    title: "Enhance a blurry photo — deblur and upscale guide | Free Image Upscaler",
    description:
      "How to sharpen detail on soft images using client-side Real-ESRGAN ×2/×4 upscaling—private, free, no upload.",
    h1: "Enhance a blurry photo",
    snippet: `<p>Motion blur and heavy JPEG compression cannot always be fully recovered, but super-resolution models add plausible detail when you need a larger, cleaner-looking file.</p>
<p>Start from the highest-quality original you have. Open ${SITE_NAME}, choose the general photo model for snapshots or the anime model for illustrations, and try ×2 before ×4. Use the side-by-side compare slider to judge faces and fine lines.</p>
<p>Nothing is uploaded; processing stays on your device. For print workflows, read <a href="/upscale-a-photo-for-print">upscale a photo for print</a>.</p>`,
  },
  {
    path: "/privacy",
    title: "Privacy Policy — Free Image Upscaler",
    description:
      "Privacy policy for Free Image Upscaler: client-side upscaling only, no image uploads, contact gentil@quevvy.com.",
    h1: "Privacy Policy",
    snippet: `<p><strong>${SITE_NAME}</strong> processes images entirely in your browser. We do not receive, store, or analyze your image files on our servers.</p>
<p>We may show advertisements from Adsterra; their partners may use cookies according to their own policies. Analytics may include the Cloudflare Web Analytics beacon on static pages.</p>
<p>Onnx models and runtime code load from this site or configured CDNs when you use the tool. No account is required.</p>
<p>Questions: <a href="mailto:gentil@quevvy.com">gentil@quevvy.com</a>. More free tools: <a href="${HUB}">web-free.site</a>.</p>`,
  },
  {
    path: "/terms",
    title: "Terms of Use — Free Image Upscaler",
    description: "Terms of use for the Free Image Upscaler web app. Provided as-is; you must respect image rights.",
    h1: "Terms of Use",
    snippet: `<p>${SITE_NAME} is provided as-is by Gentil M. You are responsible for complying with copyright and privacy laws when upscaling images you do not own or that contain personal data.</p>
<p>The service is free and offered without warranties. Do not rely on upscaled output for legal, medical, or safety-critical decisions.</p>
<p>Upstream open-source components (including <a href="https://github.com/meigo/slop-image-upscaler">slop-image-upscaler</a> by meigo, MIT) and third-party runtimes such as onnxruntime-web are subject to their respective licenses.</p>
<p>Contact: <a href="mailto:gentil@quevvy.com">gentil@quevvy.com</a>. Hub: <a href="${HUB}">web-free.site</a>.</p>`,
  },
  {
    path: "/about",
    title: "About Free Image Upscaler",
    description:
      "About Free Image Upscaler: browser Real-ESRGAN ×2/×4, based on meigo/slop-image-upscaler (MIT), credits and hub link.",
    h1: "About Free Image Upscaler",
    snippet: `<p><strong>${SITE_NAME}</strong> is a free, privacy-first image upscaler. Enlarge photos and artwork ×2 or ×4 with Real-ESRGAN models running locally via onnxruntime-web (WebGPU with WASM fallback).</p>
<p>The app builds on <a href="https://github.com/meigo/slop-image-upscaler">slop-image-upscaler</a> by meigo (MIT). We thank the Real-ESRGAN authors and the onnxruntime-web team for their open-source work.</p>
<p>Maintained by Gentil M. No sign-up, no paid API. Explore sibling tools on <a href="${HUB}">web-free.site</a>.</p>
<p>Email: <a href="mailto:gentil@quevvy.com">gentil@quevvy.com</a>.</p>`,
  },
  {
    path: "/contact",
    title: "Contact — Free Image Upscaler",
    description: "Contact Free Image Upscaler: email gentil@quevvy.com for support or privacy questions.",
    h1: "Contact",
    snippet: `<p>For questions about <strong>${SITE_NAME}</strong>, privacy, or the web-free.site tool family, email <a href="mailto:gentil@quevvy.com">gentil@quevvy.com</a>.</p>
<p>We cannot recover images you processed locally; support requests about bugs should include your browser version and steps to reproduce.</p>
<p>Hub: <a href="${HUB}">web-free.site</a>.</p>`,
  },
];

const homeTitle = "Free Image Upscaler — AI ×2/×4 photo enlarger in your browser";
const homeDescription =
  "Upscale photos and anime art ×2 or ×4 with Real-ESRGAN in your browser. Free, private, no upload—WebGPU and WASM powered.";

function upsertMeta(html, { url, title, description }) {
  let out = html;
  out = out.replace(/<html lang="[^"]*"/, '<html lang="en"');
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  if (/<meta\s+name="description"/i.test(out)) {
    out = out.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${description}" />`,
    );
  } else {
    out = out.replace("</head>", `    <meta name="description" content="${description}" />\n  </head>`);
  }
  if (!/rel="canonical"/i.test(out)) {
    out = out.replace("</head>", `    <link rel="canonical" href="${url}" />\n  </head>`);
  } else {
    out = out.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`);
  }
  const ogPairs = [
    ["og:url", url],
    ["og:title", title],
    ["og:description", description],
    ["og:type", "website"],
    ["og:site_name", SITE_NAME],
  ];
  for (const [prop, content] of ogPairs) {
    const re = new RegExp(`<meta\\s+property="${prop}"\\s+content="[^"]*"\\s*/?>`, "i");
    const tag = `<meta property="${prop}" content="${content}" />`;
    if (re.test(out)) out = out.replace(re, tag);
    else out = out.replace("</head>", `    ${tag}\n  </head>`);
  }
  return out;
}

function injectMount(html, seoBlock) {
  if (/<section id="seo-prerender"/i.test(html)) return html;
  if (html.includes('<div id="app"></div>')) {
    return html.replace('<div id="app"></div>', `${seoBlock}\n    <div id="app"></div>`);
  }
  if (html.includes('<div id="root"></div>')) {
    return html.replace('<div id="root"></div>', `${seoBlock}\n    <div id="root"></div>`);
  }
  return html.replace(/<body([^>]*)>/i, `<body$1>\n    ${seoBlock}`);
}

function buildPage(page) {
  const url = HOST + page.path;
  const seoBlock = `<section id="seo-prerender" class="seo-prerender">${`<h1>${page.h1}</h1>`}${page.snippet}</section>`;
  let html = upsertMeta(baseHtml, { url, title: page.title, description: page.description });
  html = injectMount(html, seoBlock);
  return html;
}

function buildHomeJsonLd() {
  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: HOST + "/",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: homeDescription,
    featureList: "Real-ESRGAN ×2 and ×4 upscaling, photo and anime models, compare view, PNG/JPEG download, client-side only",
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return [webApp, faq]
    .map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`)
    .join("\n    ");
}

function patchHome() {
  const url = HOST + "/";
  let html = upsertMeta(baseHtml, { url, title: homeTitle, description: homeDescription });
  const marker = 'data-seo-jsonld="home"';
  const jsonLd = `    ${buildHomeJsonLd().replace(/\n/g, "\n    ")}\n    <!-- ${marker} -->`;
  if (!html.includes(marker)) {
    html = html.replace("</head>", `${jsonLd}\n  </head>`);
  }
  const homeBody = `<section id="seo-prerender" class="seo-prerender"><h1>Free Image Upscaler</h1>${buildHomeSeoBodyHtml()}</section>`;
  html = injectMount(html, homeBody);
  fs.writeFileSync(indexPath, html);
}

for (const page of pages) {
  const dir = path.join(dist, page.path.replace(/^\//, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), buildPage(page));
}

patchHome();
console.log("Prerendered", pages.length, "route shells and patched home SEO from", indexPath);