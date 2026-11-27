<script lang="ts">
  import SiteLayout from './lib/SiteLayout.svelte'
  import App from './App.svelte'
  import HomeSeo from './lib/HomeSeo.svelte'
  import ContentPage from './pages/ContentPage.svelte'
  import { getPage, isAppRoute } from './pages/routes'
  import AdSlot from './lib/ads/AdSlot.svelte'

  let path = $state(normalizePath(location.pathname))
  let fullscreen = $state(false)

  function normalizePath(p: string) {
    const x = p.replace(/\/$/, '') || '/'
    return x
  }

  const page = $derived(getPage(path))
  const onHome = $derived(isAppRoute(path))

  $effect(() => {
    const prerender = document.getElementById('seo-prerender')
    if (prerender) prerender.remove()
  })
</script>

<svelte:window
  onpopstate={() => {
    path = normalizePath(location.pathname)
  }}
/>

<SiteLayout {fullscreen}>
  {#if onHome}
  {#if fullscreen}
    <h1 class="sr-only">Free Image Upscaler</h1>
  {/if}
    <AdSlot adSlot="betweenToolContent728x90" className="ad-home-mid" label="Sponsored" />
    <App bind:fullscreen />
    {#if !fullscreen}
      <HomeSeo />
    {/if}
  {:else if page}
    <ContentPage {page} />
  {:else}
    <article class="content-page">
      <h1>Page not found</h1>
      <p><a href="/">Return to Free Image Upscaler</a></p>
    </article>
  {/if}
</SiteLayout>

<style>
  :global(.content-page h1) {
    font-size: 1.5rem;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>