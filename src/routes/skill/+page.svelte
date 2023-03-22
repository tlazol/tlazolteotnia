<script lang="ts">
  import { browser } from '$app/environment'
  import type { PageData } from './$types'
  import { lazyLoad } from '$lib/lazyload'
  export let data: PageData
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
                defer
                class="dmm-widget-scripts"
                data-id="450bd92f27db4ff411ff71419d86c64b"
              ></script>
            {/if}
          </div>
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

  .dmmWrap {
    display: flex;
    justify-content: center;
    width: 100%;
    background-color: #fff;
    border-bottom: 1px solid var(--img-background-color);
  }

  .dmm {
    width: 336px;
    height: 280px;
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

    .dmmWrap {
      display: none;
    }
  }
</style>
