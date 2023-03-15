<script lang="ts">
  import { page } from '$app/stores'
  import Header from './Header.svelte'
  import type { PageData } from './$types'
  export let data: PageData
  import './styles.css'
</script>

<svelte:head>
  {#if data.meta}
    <title>{$page.data.meta.title ? $page.data.meta.title : data.meta.title}</title>
    <meta
      property="og:title"
      content={$page.data.meta.title ? $page.data.meta.title : data.meta.title}
    />
    <meta
      name="twitter:title"
      content={$page.data.meta.title ? $page.data.meta.title : data.meta.title}
    />
    <meta
      itemprop="name"
      content={$page.data.meta.title ? $page.data.meta.title : data.meta.title}
    />
    <meta
      name="description"
      content={$page.data.meta.description ? $page.data.meta.description : data.meta.description}
    />
    <meta
      itemprop="description"
      content={$page.data.meta.description ? $page.data.meta.description : data.meta.description}
    />
    <meta
      property="og:description"
      content={$page.data.meta.description ? $page.data.meta.description : data.meta.description}
    />
    <meta
      name="twitter:description"
      content={$page.data.meta.description ? $page.data.meta.description : data.meta.description}
    />
    <meta property="og:image" content={$page.data.meta.img ? $page.data.meta.img : data.meta.img} />
    <meta itemprop="image" content={$page.data.meta.img ? $page.data.meta.img : data.meta.img} />
    <meta
      name="twitter:image"
      content={$page.data.meta.img ? $page.data.meta.img : data.meta.img}
    />
    <meta property="og:url" content={$page.data.meta.url ? $page.data.meta.url : data.meta.url} />
    <meta name="twitter:url" content={$page.data.meta.url ? $page.data.meta.url : data.meta.url} />
  {/if}
</svelte:head>

<div class="app">
  <main>
    <slot />
  </main>

  <footer>
    <div class="iconBox">
      <div class="iconWrap">
        <span class="icon material-symbols-rounded"> account_circle </span>
        <p>Daisuke Kobayashi</p>
      </div>
      <div class="iconWrap">
        <span class="icon material-symbols-rounded"> alternate_email </span>
        <p>d.covayashi@gmail.com</p>
      </div>
      <div class="iconWrap">
        <span class="icon material-symbols-rounded"> outbound </span>
        <p>
          <a
            class="twitter"
            href="https://twitter.com/0rga"
            target="_blank"
            rel="noopener noreferrer">Twitter</a
          >
        </p>
      </div>
      <div class="iconWrap">
        <span class="icon material-symbols-rounded"> copyright </span>
        <p>Tlazolteotnia</p>
      </div>
    </div>
  </footer>

  <Header />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0 2rem;
    width: 100%;
    margin: 0 auto;
  }

  footer {
    display: flex;
    justify-content: center;
    padding: 0 2rem;
    margin-top: 12rem;
    margin-bottom: 6rem;
  }

  footer .iconBox {
    display: flex;
    flex-wrap: wrap;
    max-width: 1100px;
    width: 100%;
  }

  footer .iconWrap {
    display: flex;
    margin: 1rem 0;
    width: 100%;
  }

  footer p {
    font-size: 1.4rem;
    align-items: center;
    display: flex;
    color: var(--sub-color);
  }

  footer a {
    font-size: 1.4rem;
    align-items: center;
    display: flex;
    color: var(--blog-a-clor);
    text-decoration: underline;
    font-weight: bold;
  }

  footer .icon {
    padding-right: 0.5rem;
    font-size: 2rem;
    color: var(--sub-color);
    overflow: hidden;
    width: 3rem;
  }

  @media (min-width: 480px) {
    footer {
      padding: 1rem 0;
    }

    footer .iconWrap {
      justify-content: center;
    }
  }
</style>
