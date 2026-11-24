#!/usr/bin/env node
// Injects the web-free.site "More free tools" block and the Cloudflare Web Analytics beacon
// before </body> of every built HTML page in dist/ (outside the app root, so hydration does not remove it).
// Hooked into npm run build / postbuild so a later Vite rebuild cannot drop the home-page snippets.
import fs from "node:fs";
import path from "node:path";

const REF = "image-upscaler";
const tool = (sub, path = "/") => `https://${sub}.web-free.site${path}?ref=${REF}`;

const guidesHtml = [
  ["How to upscale an image in the browser", "/how-to-upscale-an-image-in-the-browser"],
  ["Upscale a photo for print", "/upscale-a-photo-for-print"],
  ["Enhance a blurry photo", "/enhance-a-blurry-photo"],
]
  .map(([label, href]) => `<li><a href="${href}">${label}</a></li>`)
  .join("");

const categories = [
  {
    title: "Documents &amp; writing",
    items: [
      ["Free Word Counter", tool("free-word-counter")],
      ["Free PDF Converter", tool("free-pdf-converter")],
      ["Free CV Maker", tool("free-cv-maker")],
      ["Free Invoice Generator", tool("free-invoice-generator")],
      ["Free Typing Test", tool("free-typing-test")],
      ["Free Signature Generator", tool("free-signature-generator")],
      ["Free Email Signature Generator", tool("free-email-signature-generator")],
    ],
  },
  {
    title: "Images &amp; codes",
    items: [
      ["Free QR Code Creator", tool("free-qr-code-creator")],
      ["Free Image Resizer", tool("free-image-resizer")],
      ["Free Image to Text", tool("free-image-to-text")],
      ["Free Background Remover", tool("free-background-remover")],
      ["Free Image Compressor", tool("free-image-compressor")],
      ["Free HEIC to JPG Converter", tool("free-heic-to-jpg")],
      ["__bold__", "Free Image Upscaler"],
      ["Free Passport Photo Maker", tool("free-passport-photo-maker")],
      ["Free PNG to SVG Converter", tool("free-png-to-svg")],
    ],
  },
  {
    title: "Calculators &amp; currency",
    items: [
      ["Free Online Calculator", tool("free-online-calculator", "/en/")],
      ["Free Currency Converter", tool("free-currency-converter")],
      ["Free Unit Converter", tool("free-unit-converter")],
      ["Free Loan Calculator", tool("free-loan-calculator")],
      ["Free Age Calculator", tool("free-age-calculator")],
      ["Free Percentage Calculator", tool("free-percentage-calculator")],
      ["Free BMI Calculator", tool("free-bmi-calculator")],
    ],
  },
  {
    title: "Text &amp; SEO",
    items: [
      ["Free AI Humanizer", tool("free-ai-humanizer")],
      ["Free SEO Generator", tool("free-seo-generator")],
      ["Free Backlink Generator", tool("free-backlink-generator")],
      ["Free JSON Formatter", tool("free-json-formatter")],
      ["Free Text to Speech", tool("free-text-to-speech")],
      ["Free Speech to Text", tool("free-speech-to-text")],
      ["Free Diff Checker", tool("free-diff-checker")],
    ],
  },
  {
    title: "Audio &amp; video",
    items: [
      ["Free Video to MP3 Converter", tool("free-video-to-mp3")],
      ["Free MP3 Cutter", tool("free-mp3-cutter")],
      ["Free Screen Recorder", tool("free-screen-recorder")],
      ["Free Video Compressor", tool("free-video-compressor")],
      ["Free Video to GIF Converter", tool("free-video-to-gif")],
      ["Free Audio Converter", tool("free-audio-converter")],
    ],
  },
  {
    title: "Files",
    items: [["Free ZIP Tool", tool("free-zip-tool")]],
  },
  {
    title: "Test data",
    items: [
      ["Free Fake Address Generator", tool("free-fake-address-generator")],
      ["Free Fake Name Generator", tool("free-fake-name-generator")],
    ],
  },
  {
    title: "Security &amp; passwords",
    items: [["Free Password Generator", tool("free-password-generator")]],
  },
];

function li([label, href]) {
  if (label === "__bold__") return `<li><strong>${href}</strong></li>`;
  return `<li><a href="${href}">${label}</a></li>`;
}

const catsHtml = categories
  .map(
    (cat) =>
      `<div class="wf-mt-cat"><h3>${cat.title}</h3><ul>${cat.items.map(li).join("")}</ul></div>`,
  )
  .join("");

const BLOCK = `
<aside id="wf-more-tools" class="wf-more-tools" aria-labelledby="wf-mt-title">
  <style>
    .wf-more-tools{box-sizing:border-box;width:100%;margin:2.5rem 0 0;padding:1.5rem 1rem 5rem;border-top:1px solid rgba(0,0,0,.12);background:rgba(248,249,251,.97);color:#1a1a1a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5}
    .wf-more-tools *{box-sizing:border-box}
    .wf-more-tools h2{margin:0 0 .35rem;font-size:1.15rem;font-weight:700}
    .wf-more-tools .wf-mt-lead{margin:0 0 1rem;color:#333}
    .wf-more-tools .wf-mt-lead a{color:#0b57d0}
    .wf-more-tools .wf-mt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem 1.25rem}
    .wf-more-tools h3{margin:0 0 .4rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:#444}
    .wf-more-tools ul{margin:0;padding:0;list-style:none}
    .wf-more-tools li{margin:0 0 .25rem}
    .wf-more-tools a{color:#0b57d0;text-decoration:underline}
    .wf-more-tools a:hover{text-decoration:none}
    @media (prefers-color-scheme:dark){
      .wf-more-tools{background:rgba(22,24,28,.96);color:#f2f2f2;border-top-color:rgba(255,255,255,.14)}
      .wf-more-tools .wf-mt-lead,.wf-more-tools h3{color:#c8c8c8}
      .wf-more-tools a{color:#8ab4f8}
    }
  </style>
  <h2 id="wf-mt-title">More free tools</h2>
  <p class="wf-mt-lead">These utilities run in your browser. Browse the full list on <a href="https://web-free.site/?ref=${REF}">web-free.site</a>.</p>
  <div class="wf-mt-grid">
    <div class="wf-mt-cat wf-mt-guides"><h3>Guides on this site</h3><ul>${guidesHtml}</ul></div>
    ${catsHtml}
  <h3>Time</h3><ul><li><a href="https://free-time-zone-converter.web-free.site/?ref=image-upscaler">Free Time Zone Converter</a></li></ul><h3>Drawing</h3><ul><li><a href="https://free-whiteboard.web-free.site/?ref=image-upscaler">Free Whiteboard</a></li></ul><h3>Random &amp; pickers</h3><ul><li><a href="https://free-spin-wheel.web-free.site/?ref=image-upscaler">Free Spin Wheel</a></li></ul></div>
</aside>
`;

const MARKER = 'id="wf-more-tools"';
const BEACON = "static.cloudflareinsights.com/beacon.min.js";
const SNIPPET_BEACON = `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "3e2f5f96ab32442ebb6e6f650615b58a"}'></script><!-- End Cloudflare Web Analytics -->`;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git" || name === ".next" || name === "ads") continue;
      walk(p, acc);
    } else if (name.endsWith(".html") && st.size >= 80) acc.push(p);
  }
  return acc;
}

function inject(text) {
  const idx = text.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return { text, changed: false };
  const parts = [];
  if (!text.includes(MARKER)) parts.push(BLOCK);
  if (!text.includes(BEACON)) parts.push(SNIPPET_BEACON);
  if (!parts.length) return { text, changed: false };
  return { text: text.slice(0, idx) + parts.join("\n") + "\n" + text.slice(idx), changed: true };
}

const root = path.resolve(process.argv[2] || "dist");
let n = 0;
for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (rel.startsWith("ads/") || rel.includes("/ads/")) continue;
  const { text, changed } = inject(fs.readFileSync(file, "utf8"));
  if (changed) {
    fs.writeFileSync(file, text);
    n += 1;
  }
}
console.log("inject-more-tools: updated", n, "HTML files in", root);