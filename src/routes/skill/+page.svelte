<script lang="ts">
  export let data: PageData
  import { browser } from '$app/environment'
  import type { PageData } from './$types'
  import { lazyLoad } from '$lib/lazyload'
  import NendAd from '$lib/NendAd.svelte'
</script>

<div class="skillListWrap">
  <div class="skillList">
    {#each data.skills as [k, v], i}
      <div class="skill">
        <a href={`/skill/${v.shortId}`}>
          <picture>
            <source srcset={`/img/material/${v.id}.webp`} type="image/webp" />
            <img
              use:lazyLoad={`/img/material/${v.id}.jpg`}
              alt={v.name[data.lang]}
              loading="lazy"
            />
          </picture>
        </a>
      </div>
      {#if i === 0}
        <div class="nendAdWrap">
          <NendAd />
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .skillListWrap {
    display: flex;
    justify-content: center;
  }

  .skillList {
    display: flex;
    flex-wrap: wrap;
    max-width: 1100px;
    width: 100%;
  }

  .skillList .skill:first-child {
    margin-top: 2rem;
  }

  .skill {
    width: 100%;
    aspect-ratio: 16 / 9;
    background-color: var(--img-background-color);
  }

  .skill img {
    opacity: 0;
    transition: all 0.5s ease;
  }

  @media (min-width: 480px) {
    .skillList {
      flex-wrap: nowrap;
      height: 100vh;
    }

    .skillList .skill:first-child {
      margin-top: 0;
    }

    .skill {
      overflow: hidden;
    }

    a {
      display: flex;
      justify-content: center;
    }

    picture {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    img {
      max-width: none;
      max-height: 100vh;
    }

    .nendAdWrap {
      display: none;
    }
  }
</style>
