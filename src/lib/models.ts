import type { ModelId } from '../types'

export interface ModelInfo {
  id: ModelId
  label: string
  url: string
  bytes: number
  slowOnCpu: boolean
  /** RRDB network: its ×4 feature maps (~1.2 GB per 512px tile) crashed an iPad Safari tab. */
  desktopOnly: boolean
}

const base = import.meta.env.BASE_URL
// Pinned to a commit so the cached bytes never silently change under the same URL.
const HF_SHA = '09f741bac80a246b407da3ee902bf5f3291b602f'

export const MODELS: Record<ModelId, ModelInfo> = {
  general: {
    id: 'general',
    label: 'General (fast)',
    url: `${base}models/realesr-general-x4v3.onnx`,
    bytes: 4_866_395,
    slowOnCpu: false,
    desktopOnly: false,
  },
  anime: {
    id: 'anime',
    label: 'Anime / illustration',
    url: `${base}models/realesrgan-x4plus-anime-6b.onnx`,
    bytes: 17_961_299,
    slowOnCpu: false,
    desktopOnly: true,
  },
  photo: {
    id: 'photo',
    label: 'Photo (high quality)',
    url: `https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/${HF_SHA}/real_esrgan_x4.onnx`,
    bytes: 67_051_616,
    slowOnCpu: true,
    desktopOnly: true,
  },
}

export const MODEL_ORDER: ModelId[] = ['general', 'anime', 'photo']
export const DEFAULT_MODEL: ModelId = 'general'

export function modelAvailable(model: ModelInfo, appleTouch: boolean): boolean {
  return !(appleTouch && model.desktopOnly)
}
