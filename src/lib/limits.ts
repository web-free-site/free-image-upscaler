/** Output caps. 8192² RGBA is 256 MB — the most we hold in memory at once. iPhone/iPad Safari
 *  refuses canvases over 16.7 MP, so the result could not even be displayed there. */
export const MAX_OUTPUT_SIDE = 8192
export const MAX_PIXELS_DESKTOP = 8192 * 8192
export const MAX_PIXELS_APPLE_TOUCH = 16_777_216

/** Largest input (same aspect) whose ×scale output fits both caps. ok = input already fits. */
export function fitInput(
  w: number,
  h: number,
  scale: number,
  maxPixels: number,
): { ok: boolean; w: number; h: number } {
  const k = Math.min(
    1,
    MAX_OUTPUT_SIDE / (Math.max(w, h) * scale),
    Math.sqrt(maxPixels / (w * h * scale * scale)),
  )
  if (k >= 1) return { ok: true, w, h }
  // Epsilon: 4000 * (8192 / 16000) lands a hair under 2048 in floating point.
  const dim = (v: number) => Math.max(1, Math.floor(v * k + 1e-9))
  return { ok: false, w: dim(w), h: dim(h) }
}
