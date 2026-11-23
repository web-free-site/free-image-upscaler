<script lang="ts">
  import AdSlot from './ads/AdSlot.svelte'
  import SponsoredSmartlink from './ads/SponsoredSmartlink.svelte'
  import { SITE } from '../site'

  let { fullscreen = false, children }: { fullscreen?: boolean; children: import('svelte').Snippet } = $props()
</script>

<div class="site" class:fullscreen>
  <header class="site-header">
    <AdSlot adSlot="header728x90" className="ad-header" label="Sponsored" />
    <div class="site-header__inner">
      <a href="/" class="brand">
        <span class="brand__mark">↑</span>
        <span class="brand__text">
          <strong>{SITE.name}</strong>
          <small>Real-ESRGAN ×2 / ×4 · nothing uploaded</small>
        </span>
      </a>
      <nav class="nav" aria-label="Main">
        <a href="/">Upscale</a>
        <a href="/how-to-upscale-an-image-in-the-browser">How-to</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </nav>
    </div>
  </header>

  <div class="site-body">
    <main class="site-main">
      {@render children()}
    </main>
    {#if !fullscreen}
      <aside class="site-sidebar" aria-label="Sidebar">
        <AdSlot adSlot="sidebar160x600" className="ad-sidebar" />
        <AdSlot adSlot="sidebar160x300" className="ad-sidebar-narrow" />
      </aside>
    {/if}
  </div>

  {#if !fullscreen}
    <footer class="site-footer">
      <p>
        <a href={SITE.hubUrl}>web-free.site</a>
        · MIT <a href={SITE.upstreamUrl} rel="noopener noreferrer">{SITE.upstreamName}</a>
        · Real-ESRGAN · onnxruntime-web
      </p>
      <p>
        <a href="/privacy">Privacy</a>
        · <a href="/terms">Terms</a>
        · <a href="/about">About</a>
        · <a href="/contact">Contact</a>
        · <a href="mailto:{SITE.contactEmail}">{SITE.contactEmail}</a>
      </p>
      <SponsoredSmartlink />
    </footer>
  {/if}

  <AdSlot adSlot="mobileSticky320x50" className="ad-mobile-sticky" label="Sponsored" />
</div>

<style>
  .site {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-ground);
  }
  .site.fullscreen .site-header,
  .site.fullscreen .site-footer,
  .site.fullscreen .site-sidebar {
    display: none;
  }
  .site-header {
    border-bottom: 1px solid var(--color-line);
    background: var(--color-panel);
  }
  .site-header__inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
    color: inherit;
  }
  .brand__mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 6px;
    background: var(--color-accent);
    color: var(--color-ground);
    font-weight: 700;
    font-size: 14px;
  }
  .brand__text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .brand__text strong {
    font-size: 14px;
    color: var(--color-text);
  }
  .brand__text small {
    font-size: 11px;
    color: var(--color-muted);
  }
  .nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    font-size: 13px;
  }
  .nav a {
    color: var(--color-muted);
    text-decoration: none;
  }
  .nav a:hover {
    color: var(--color-accent);
  }
  .site-body {
    flex: 1;
    display: flex;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    min-height: 0;
  }
  .site-main {
    flex: 1;
    min-width: 0;
    padding-bottom: 56px;
  }
  @media (min-width: 640px) {
    .site-main {
      padding-bottom: 0;
    }
  }
  .site-sidebar {
    width: 170px;
    flex-shrink: 0;
    padding: 0.5rem;
    display: none;
  }
  @media (min-width: 900px) {
    .site-sidebar {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  }
  .site-footer {
    border-top: 1px solid var(--color-line);
    padding: 1rem;
    text-align: center;
    font-size: 12px;
    color: var(--color-muted);
    background: var(--color-panel);
  }
  .site-footer a {
    color: var(--color-accent);
  }
  .site-footer p {
    margin: 0.25rem 0;
  }
  :global(.ad-mobile-sticky) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 40;
    background: var(--color-panel);
    border-top: 1px solid var(--color-line);
    padding: 4px;
    display: flex;
    justify-content: center;
  }
  @media (min-width: 640px) {
    :global(.ad-mobile-sticky) {
      display: none;
    }
  }
  :global(.ad-header) {
    padding: 4px 8px;
    justify-content: center;
  }
  :global(.seo-prerender) {
    display: none;
  }
</style>