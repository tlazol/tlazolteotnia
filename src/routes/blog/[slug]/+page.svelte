<script lang="ts">
  export let data: PageData
  export const hoge = 'aaaa'
  import { browser } from '$app/environment'
  import { assets } from '$app/paths'
  import type { PageData } from './$types'
  import { getDateJa, getKeywordsArray } from '$lib/util'
  import './prism.css'
</script>

<svelte:head>
  <script defer src="{assets}/prism.js"></script>
  {@html `
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "Article",
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": "${data.meta.url}"
        },
        "headline": "${data.meta.title}",
        "datePublished": "${data.meta.createdAt}",
        "dateModified": "${data.meta.updatedAt}",
        "author": [
          {
            "@type": "Person",
            "name": "Daisuke Kobayashi"
          }
        ],
        "image": {
          "@type": "ImageObject",
          "url": "${data.meta.img}",
          "width": 1200,
          "height": 630
        },
        "description": "${data.meta.description}"
      }
    </script>
  `}
</svelte:head>

<div class="wrap">
  <div id="blogWrap">
    <div class="title">{data.blogEntry.fields.text}</div>
    <div class="keywords">
      {#each getKeywordsArray(String(data.blogEntry.fields.keywords)) as keyword}
        <span class="keyword">{keyword.trim()}</span>
      {/each}
    </div>
    <div class="date">{getDateJa(String(data.blogEntry.fields.date))}</div>
    <div class="dmmWrap">
      <div class="dmm">
        {#if browser}
          <ins
            class="dmm-widget-placement"
            data-id="450bd92f27db4ff411ff71419d86c64b"
            style="background:transparent"
          />
          <script
            src="https://widget-view.dmm.com/js/placement.js"
            class="dmm-widget-scripts"
            data-id="450bd92f27db4ff411ff71419d86c64b"
          ></script>
        {/if}
      </div>
    </div>
    {@html data.blogEntry.fields.markdown}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    justify-content: center;
  }

  .dmmWrap {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
  }

  .dmm {
    width: 336px;
    height: 280px;
  }

  #blogWrap {
    max-width: 800px;
    width: 100%;
  }

  .title {
    font-size: 5rem;
    line-height: 6rem;
    font-weight: bold;
    margin-top: 2rem;
  }

  .date {
    font-size: 1.4rem;
    margin-top: 1rem;
    color: var(--sub-color);
  }

  .keywords {
    display: flex;
    flex-wrap: wrap;
  }

  .keyword {
    font-size: 1.4rem;
    color: var(--sub-color);
    padding: 0.5rem;
    border: 0.1rem solid var(--sub-color);
    border-radius: 0.7rem;
    margin-top: 1rem;
    margin-right: 1rem;
  }

  @media (min-width: 480px) {
    .title {
      font-size: 8rem;
      line-height: 10rem;
      margin-top: 5rem;
    }

    .dmmWrap {
      display: none;
    }
  }
</style>
