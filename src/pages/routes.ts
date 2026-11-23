export type PageDef = {
  path: string
  title: string
  paragraphs: string[]
  links?: { href: string; label: string }[]
}

export const PAGES: PageDef[] = [
  {
    path: '/how-to-upscale-an-image-in-the-browser',
    title: 'How to upscale an image in the browser',
    paragraphs: [
      'Open Free Image Upscaler, pick a photo from your device, choose a Real-ESRGAN model, and select ×2 or ×4. The model loads once per session; compare with split or side-by-side view, then download PNG or JPEG.',
      'All inference runs on your GPU (WebGPU) or falls back to WASM. Nothing is uploaded.',
    ],
    links: [
      { href: '/upscale-a-photo-for-print', label: 'Upscale a photo for print' },
      { href: '/enhance-a-blurry-photo', label: 'Enhance a blurry photo' },
      { href: '/', label: 'Open the upscaler' },
    ],
  },
  {
    path: '/upscale-a-photo-for-print',
    title: 'Upscale a photo for print',
    paragraphs: [
      'Print at 300 DPI: divide pixel width by 300 to estimate inches. If the file is too small, try ×2 or ×4 upscaling before sending to a lab.',
      'Preview on screen before ordering large prints; upscaling adds pixels but cannot invent detail that was never captured.',
    ],
    links: [{ href: '/', label: 'Upscale now' }],
  },
  {
    path: '/enhance-a-blurry-photo',
    title: 'Enhance a blurry photo',
    paragraphs: [
      'Start from the best original you have. Use the general photo model for snapshots or the anime model for illustrations. Try ×2 before ×4.',
      'Heavy blur or compression may limit results; compare with the slider before downloading.',
    ],
    links: [{ href: '/', label: 'Try Free Image Upscaler' }],
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    paragraphs: [
      'Free Image Upscaler processes images entirely in your browser. We do not receive, store, or analyze your files on our servers.',
      'Adsterra ads and Cloudflare Web Analytics may use cookies per their policies. No account is required.',
      'Contact gentil@quevvy.com for privacy questions.',
    ],
  },
  {
    path: '/terms',
    title: 'Terms of Use',
    paragraphs: [
      'The tool is provided as-is. You are responsible for image rights and lawful use.',
      'Do not rely on upscaled output for critical decisions. Upstream MIT components include slop-image-upscaler by meigo and onnxruntime-web.',
    ],
  },
  {
    path: '/about',
    title: 'About',
    paragraphs: [
      'Free Image Upscaler enlarges photos and artwork ×2 or ×4 with Real-ESRGAN in the browser (WebGPU + WASM).',
      'Based on slop-image-upscaler by meigo (MIT). Credits: Real-ESRGAN authors, onnxruntime-web. Part of the web-free.site family.',
    ],
    links: [{ href: 'https://github.com/meigo/slop-image-upscaler', label: 'Upstream on GitHub' }],
  },
  {
    path: '/contact',
    title: 'Contact',
    paragraphs: ['Email gentil@quevvy.com for support, corrections, or privacy requests.'],
  },
]

export function getPage(pathname: string): PageDef | undefined {
  const path = pathname.replace(/\/$/, '') || '/'
  return PAGES.find((p) => p.path === path)
}

export function isAppRoute(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  return path === '/'
}