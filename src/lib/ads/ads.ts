export type BannerDef = { key: string; width: number; height: number }

export type AdsConfig = {
  enabled: boolean
  bannerScriptBase?: string
  socialBar?: string
  popunder?: string
  nativeBanner?: { src: string; containerId: string }
  smartlink?: { url: string; label?: string }
  banners?: Record<string, BannerDef>
  slots?: Record<string, string>
}

export type AdSlotName =
  | 'header728x90'
  | 'homeTop728x90'
  | 'betweenToolContent728x90'
  | 'sidebar160x600'
  | 'sidebar160x300'
  | 'mobileSticky320x50'
  | 'nativeBelowResult'
  | 'content468x60'
  | 'content300x250'

export const DEFAULT_BANNER_BASE = 'https://bauval.org/22'

let adsCache: AdsConfig | null = null

export async function loadAds(): Promise<AdsConfig> {
  if (adsCache) return adsCache
  try {
    const res = await fetch('/ads.json')
    adsCache = (await res.json()) as AdsConfig
  } catch {
    adsCache = { enabled: false }
  }
  return adsCache
}

export function bannerIframeSrcDoc(
  key: string,
  width: number,
  height: number,
  scriptBase: string,
): string {
  const atOptions = JSON.stringify({
    key,
    format: 'iframe',
    height,
    width,
    params: {},
  })
  const src = `${scriptBase.replace(/\/$/, '')}/${key}`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer-when-downgrade"></head><body style="margin:0;padding:0;overflow:hidden;background:transparent"><script type="text/javascript">var atOptions = ${atOptions};</script><script type="text/javascript" src="${src}"><\/script></body></html>`
}