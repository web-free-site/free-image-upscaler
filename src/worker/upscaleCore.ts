import type { RasterImage } from '../types'
import { planTiles, extractTile, pasteTile } from './tiling'
import {
  toPlanarRgb,
  fromPlanarRgb,
  hasAlpha,
  alphaOf,
  setAlpha,
  resizeChannelBilinear,
  bleedTransparent,
} from './pixels'

export interface UpscaleOptions {
  tile: number // core tile size in input px
  pad: number // context px per side, cropped after inference
  modelScale: number // the model's native factor (4)
  outScale: number // requested factor; must divide modelScale
  onTile?: (done: number, total: number) => void
}

export interface UpscaleDeps {
  /** Planar RGB [1,3,h,w] in [0,1] → planar RGB [1,3,h*modelScale,w*modelScale]. */
  run(input: Float32Array, w: number, h: number): Promise<Float32Array>
  /** High-quality RGBA resize (pica Lanczos in the worker). */
  resize(img: RasterImage, tw: number, th: number): Promise<RasterImage>
}

export async function upscaleImage(
  img: RasterImage,
  opts: UpscaleOptions,
  deps: UpscaleDeps,
): Promise<RasterImage> {
  const { tile, pad, modelScale, outScale } = opts
  const out: RasterImage = {
    width: img.width * outScale,
    height: img.height * outScale,
    data: new Uint8ClampedArray(img.width * outScale * img.height * outScale * 4),
  }
  const alpha = hasAlpha(img)
  const src = alpha ? bleedTransparent(img) : img
  const rects = planTiles(img.width, img.height, tile)
  for (const [i, r] of rects.entries()) {
    const t = extractTile(src, r, pad)
    const y = await deps.run(toPlanarRgb(t), t.width, t.height)
    let up = fromPlanarRgb(y, t.width * modelScale, t.height * modelScale)
    // Downscale the whole padded tile, then crop: the pad keeps the resize kernel off the seam.
    if (outScale !== modelScale) up = await deps.resize(up, t.width * outScale, t.height * outScale)
    pasteTile(out, up, r, pad, outScale)
    opts.onTile?.(i + 1, rects.length)
  }
  if (alpha)
    setAlpha(out, resizeChannelBilinear(alphaOf(img), img.width, img.height, out.width, out.height))
  return out
}
