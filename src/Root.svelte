<script lang="ts">
  import SiteLayout from './lib/SiteLayout.svelte'
  import App from './App.svelte'
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
    <AdSlot adSlot="betweenToolContent728x90" className="ad-home-mid" label="Sponsored" />
    <App bind:fullscreen />
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
</style>