<script lang="ts">
  import { onMount } from 'svelte'
  import { loadAds } from './ads'

  let link = $state<{ url: string; label: string } | null>(null)

  onMount(() => {
    loadAds().then((cfg) => {
      if (cfg.enabled && cfg.smartlink?.url) {
        link = { url: cfg.smartlink.url, label: cfg.smartlink.label || 'Sponsored' }
      }
    })
  })
</script>

{#if link}
  <p class="ad-smartlink">
    <a href={link.url} target="_blank" rel="sponsored noopener noreferrer">{link.label}</a>
  </p>
{/if}

<style>
  .ad-smartlink {
    margin: 0.5rem 0 0;
    font-size: 12px;
  }
  .ad-smartlink a {
    color: var(--color-muted);
  }
</style>