import type { RasterImage } from '../types'

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

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
