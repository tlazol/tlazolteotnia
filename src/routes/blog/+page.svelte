<script lang="ts">
  export let data: PageData
  import type { PageData } from './$types'
  import { getDateJa, getKeywordsArray } from '$lib/util'
</script>

<div class="blogListWrap">
  <div class="blogList">
    {#each data.list.items as { sys, fields }}
      {#if fields}
        <a href="/blog/{sys.id}">
          <div class="iconWrap">
            <span class="icon material-symbols-rounded text-gradient"
              >{fields.icon ? fields.icon : 'notes'}</span
            >
          </div>
          <h1 class="title">{fields.text}</h1>
          <p class="keywords">
            {#each getKeywordsArray(String(fields.keywords)) as keyword}
              <span class="keyword">{keyword.trim()}</span>
            {/each}
          </p>
          <p class="date">{getDateJa(String(fields.date))}</p>
        </a>
      {/if}
    {/each}
  </div>
</div>

<style>
  .blogListWrap {
    display: flex;
    justify-content: center;
  }

  .blogList {
    display: flex;
    flex-wrap: wrap;
    max-width: 1100px;
    width: 100%;
  }

  .blogList a {
    width: 100vw;
    overflow: hidden;
  }

  .iconWrap {
    display: flex;
    justify-content: center;
    width: 100%;
    border: 0.1rem solid var(--sub-color-3);
    margin-top: 3rem;
    border-radius: 1rem;
    padding: 4rem 0;
  }

  .blogList a:first-child .iconWrap {
    margin-top: 2rem;
  }

  .icon {
    font-size: 10rem;
    color: var(--key-color);
  }

  .title {
    font-size: 1.8rem;
    font-weight: bold;
    margin-top: 0.5rem;
    line-height: 3rem;
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
    .blogList a:first-child .iconWrap {
      margin-top: 3rem;
    }
    .blogList a {
      width: 33.3%;
      padding: 0 0.5rem 0.5rem;
    }
  }
</style>
