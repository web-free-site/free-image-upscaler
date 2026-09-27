import type { RasterImage } from '../types'

export async function fileToRasterImage(file: Blob): Promise<RasterImage> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error('undecodable')
  }
  const canvas = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0) // transparency kept: the upscaler carries alpha through
  bmp.close()
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { width: d.width, height: d.height, data: d.data }
}

/** Successive drawImage sizes, each at most a 2× reduction, ending on the target. Ported from
 *  slop-vectorizer: Chrome point-samples a single drawImage past ~2× minification. */
export function resampleSteps(
  w: number,
  h: number,
  tw: number,
  th: number,
): { w: number; h: number }[] {
  const steps: { w: number; h: number }[] = []
  while (w > tw * 2 || h > th * 2) {
    w = Math.max(tw, Math.ceil(w / 2))
    h = Math.max(th, Math.ceil(h / 2))
    steps.push({ w, h })
  }
  if (steps.length === 0 || steps[steps.length - 1].w !== tw || steps[steps.length - 1].h !== th)
    steps.push({ w: tw, h: th })
  return steps
}

/** Downscale for the size-cap dialog. */
export function resizeImage(img: RasterImage, tw: number, th: number): RasterImage {
  let src = new OffscreenCanvas(img.width, img.height)
  src.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0)
  for (const step of resampleSteps(img.width, img.height, tw, th)) {
    const c = new OffscreenCanvas(step.w, step.h)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, step.w, step.h)
    src = c
  }
  const d = src.getContext('2d')!.getImageData(0, 0, tw, th)
  return { width: tw, height: th, data: d.data }
}
