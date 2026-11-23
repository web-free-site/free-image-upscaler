#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const HOST = "https://free-image-upscaler.web-free.site";
const paths = [
  "/",
  "/how-to-upscale-an-image-in-the-browser",
  "/upscale-a-photo-for-print",
  "/enhance-a-blurry-photo",
  "/privacy",
  "/terms",
  "/about",
  "/contact",
];

const urls = paths
  .map(
    (p) => `  <url>
    <loc>${HOST}${p === "/" ? "/" : p}</loc>
    <changefreq>weekly</changefreq>
    <priority>${p === "/" ? "1.0" : "0.8"}</priority>
  </url>`,
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const outDir = path.resolve("dist");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml);
console.log("Wrote dist/sitemap.xml");