<!-- Ad banner slot (isolated iframe) -->
<script lang="ts">
  import { onMount } from 'svelte'
  import {
    loadAds,
    bannerIframeSrcDoc,
    DEFAULT_BANNER_BASE,
    type AdSlotName,
    type AdsConfig,
    type BannerDef,
  } from './ads'

  let {
    adSlot,
    className = '',
    label = 'Advertisement',
  }: {
    adSlot: AdSlotName
    className?: string
    label?: string
  } = $props()

  let cfg = $state<AdsConfig | null>(null)
  let nativeMounted = $state(false)

  onMount(() => {
    loadAds().then((loaded) => {
      cfg = loaded
    })
  })

  const mapped = $derived(cfg?.slots?.[adSlot] ?? adSlot)
  const def = $derived(
    cfg?.banners && typeof mapped === 'string' ? (cfg.banners[mapped] as BannerDef | undefined) : undefined,
  )
  const scriptBase = $derived(cfg?.bannerScriptBase || DEFAULT_BANNER_BASE)
  const srcDoc = $derived(def ? bannerIframeSrcDoc(def.key, def.width, def.height, scriptBase) : '')

  $effect(() => {
    if (nativeMounted || !cfg?.enabled) return
    if (mapped !== 'nativeBanner' && adSlot !== 'nativeBelowResult') return
    const native = cfg.nativeBanner
    if (!native?.src || !native.containerId) return
    if (document.querySelector(`script[data-ad="native-${native.containerId}"]`)) return
    const script = document.createElement('script')
    script.src = native.src
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    script.setAttribute('data-ad', `native-${native.containerId}`)
    document.body.appendChild(script)
    nativeMounted = true
  })
</script>

{#if cfg?.enabled}
  {#if mapped === 'nativeBanner' || adSlot === 'nativeBelowResult'}
    {@const native = cfg.nativeBanner}
    {#if native?.containerId}
      <aside class="ad-slot {className}" aria-label={label} data-ad-slot={adSlot}>
        <div class="ad-slot__label">{label}</div>
        <div id={native.containerId} class="ad-slot__native"></div>
      </aside>
    {/if}
  {:else if def?.key}
    <aside class="ad-slot {className}" aria-label={label} data-ad-slot={adSlot}>
      <div class="ad-slot__label">{label}</div>
      <iframe
        title="Advertisement {adSlot}"
        width={def.width}
        height={def.height}
        class="ad-slot__frame"
        style:max-width="100%"
        style:border="0"
        style:height="{def.height}px"
        style:overflow="hidden"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        srcdoc={srcDoc}
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    </aside>
  {/if}
{/if}

<style>
  .ad-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin: 0.5rem 0;
  }
  .ad-slot__label {
    font-size: 10px;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .ad-slot__frame {
    background: transparent;
  }
  .ad-slot__native {
    min-height: 50px;
    width: 100%;
    max-width: 728px;
  }
</style>