<script lang="ts">
  import type { PageDef } from './routes'
  import AdSlot from '../lib/ads/AdSlot.svelte'
  import { SITE } from '../site'

  let { page }: { page: PageDef } = $props()
</script>

<article class="content-page">
  <h1>{page.title}</h1>
  {#each page.paragraphs as p}
    <p>{p}</p>
  {/each}
  {#if page.links?.length}
    <ul class="page-links">
      {#each page.links as l}
        <li><a href={l.href}>{l.label}</a></li>
      {/each}
    </ul>
  {/if}
  <AdSlot adSlot="content468x60" className="ad-mid" label="Sponsored" />
  <AdSlot adSlot="content300x250" className="ad-content" />
  <p class="hub">
    <a href={SITE.hubUrl}>More free tools on web-free.site</a>
  </p>
</article>

<style>
  .content-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    font-size: 15px;
    line-height: 1.6;
    color: var(--color-text);
  }
  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1rem;
  }
  p {
    margin: 0 0 1rem;
    color: var(--color-muted);
  }
  .page-links {
    margin: 0 0 1.5rem;
    padding-left: 1.25rem;
  }
  .page-links a {
    color: var(--color-accent);
  }
  .hub {
    margin-top: 2rem;
    font-size: 13px;
  }
  .hub a {
    color: var(--color-accent);
  }
</style>