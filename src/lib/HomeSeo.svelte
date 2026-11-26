<script lang="ts">
  import homeSeo from '../home-seo.json'
  import { SITE } from '../site'

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: homeSeo.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
</script>

<svelte:head>
  <script type="application/ld+json">
    {JSON.stringify(faqJsonLd)}
  </script>
</svelte:head>

<section id="home-seo" class="home-seo" aria-labelledby="home-seo-title">
  <h2 id="home-seo-title">About this free AI image upscaler</h2>
  <p>
    <strong>Free Image Upscaler</strong> enlarges JPEG, PNG, WebP, and HEIC photos ×2 or ×4 using
    Real-ESRGAN super-resolution models that run completely inside your browser. Unlike cloud upscalers
    that send your picture to a remote server, this tool keeps every pixel on your machine: you pick a
    file from disk, the ONNX runtime loads the model from this site, and inference happens in a Web
    Worker with WebGPU or WebAssembly.
  </p>
  <p>
    That design matters for privacy, speed on good hardware, and predictable cost: there is no account,
    no API key, and no per-image fee. You get a practical photo enlarger and anime upscaler in one
    page, with a split or side-by-side compare view so you can judge faces, hair, and fine text before
    you download.
  </p>

  <h2>How to upscale an image in five steps</h2>
  <ol class="home-seo-steps">
    {#each homeSeo.steps as step, i}
      <li><strong>Step {i + 1}.</strong> {step}</li>
    {/each}
  </ol>
  <p>
    If you are new to super-resolution, read our
    <a href={homeSeo.guideUrl}>hub guide to upscaling in the browser</a>
    or the on-site walkthrough at
    <a href="/how-to-upscale-an-image-in-the-browser">how to upscale an image in the browser</a>. For
    print sizing, see <a href="/upscale-a-photo-for-print">upscale a photo for print</a>; for soft
    originals, try <a href="/enhance-a-blurry-photo">enhance a blurry photo</a>.
  </p>

  <h2>Privacy and in-browser processing</h2>
  <p>
    We do not receive, store, or analyze your images on a backend. Model weights and runtime code
    download to your browser cache like any other static asset, but your creative work stays local. You
    can use the tool offline after models are cached, subject to browser storage limits. Because
    processing uses your CPU or GPU, very large outputs may take longer on older phones; the app can
    suggest downscaling an oversized input before a ×4 run so you stay within safe memory limits.
  </p>

  <h2>Common use cases</h2>
  <ul class="home-seo-uses">
    {#each homeSeo.useCases as use}
      <li>{use}</li>
    {/each}
  </ul>
  <p>
    Real-ESRGAN adds plausible detail—it cannot invent perfect focus from extreme blur—but it is a strong
    last step before layout, thumbnails, or print orders when your source file is only slightly too small.
  </p>

  <h2 id="home-seo-faq">Frequently asked questions</h2>
  <div class="home-seo-faq">
    {#each homeSeo.faq as item}
      <div class="home-seo-faq-item">
        <h3>{item.q}</h3>
        <p>{item.a}</p>
      </div>
    {/each}
  </div>

  <p class="home-seo-hub">
    Explore more utilities on <a href={SITE.hubUrl}>web-free.site</a> or follow the step-by-step
    <a href={homeSeo.guideUrl}>Free Image Upscaler guide</a> on the hub.
  </p>
</section>

<style>
  .home-seo {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
    font-size: 15px;
    line-height: 1.65;
    color: var(--color-text);
    text-align: left;
    border-top: 1px solid var(--color-line);
  }
  .home-seo h2 {
    font-size: 1.15rem;
    font-weight: 600;
    margin: 1.75rem 0 0.75rem;
    color: var(--color-text);
  }
  .home-seo h2:first-child {
    margin-top: 0;
  }
  .home-seo h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.35rem;
    color: var(--color-text);
  }
  .home-seo p {
    margin: 0 0 1rem;
    color: var(--color-muted);
  }
  .home-seo ol,
  .home-seo ul {
    margin: 0 0 1rem;
    padding-left: 1.35rem;
    color: var(--color-muted);
  }
  .home-seo li {
    margin-bottom: 0.5rem;
  }
  .home-seo a {
    color: var(--color-accent);
  }
  .home-seo-faq-item {
    margin-bottom: 1.25rem;
  }
  .home-seo-faq-item p {
    margin: 0;
  }
  .home-seo-hub {
    margin-top: 1.5rem;
    font-size: 14px;
  }
</style>