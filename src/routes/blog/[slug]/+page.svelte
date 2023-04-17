<script lang="ts">
  import { assets } from '$app/paths'
  import type { PageData } from './$types'
  import { getDateJa, getKeywordsArray } from '$lib/util'
  import NendAd from '$lib/NendAd.svelte'
  import DmmAd from '$lib/DmmAd.svelte'
  import '../../blog.css'
  import './prism.css'
  export let data: PageData
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
    <div class="nendAdWrap">
      <NendAd />
    </div>
    {@html data.blogEntry.fields.markdown}
    <div class="dmmAdWrap">
      <DmmAd />
    </div>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    justify-content: center;
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

  .nendAdWrap {
    margin-top: 2rem;
  }

  .dmmAdWrap {
    margin-top: 3rem;
  }

  @media (min-width: 480px) {
    .title {
      font-size: 8rem;
      line-height: 10rem;
      margin-top: 5rem;
    }

    .nendAdWrap {
      display: none;
    }

    .dmmAdWrap {
      display: none;
    }
  }
</style>
