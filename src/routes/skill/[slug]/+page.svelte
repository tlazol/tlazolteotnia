<script lang="ts">
  import { browser } from '$app/environment'
  import type { PageData } from './$types'
  import { lazyLoad } from '$lib/lazyload'
  export let data: PageData

  let clapNum: number = 0

  const getClap = async () => {
    if (browser) {
      const url = `https://us-central1-tlazolteotnia.cloudfunctions.net/getClap?skill=${data.id}`
      const res = await fetch(url)
      const clap: { [key: string]: number } = await res.json()
      clapNum = clap.count
      return clapNum
    }
  }

  const incrementClap = async () => {
    if (browser) {
      clapNum++
      const url = `https://us-central1-tlazolteotnia.cloudfunctions.net/setClap?skill=${data.id}`
      fetch(url)
    }
  }
</script>

<div class="skillWrap">
  <div class="skill">
    <div class="hero">
      <picture>
        <source srcset={`/img/material/${data.skill.id}.webp`} type="image/webp" />
        <img
          use:lazyLoad={`/img/material/${data.skill.id}.jpg`}
          alt={data.skill.name[data.lang]}
          loading="lazy"
        />
      </picture>
    </div>
    <div class="clapWrap">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div class="clapColumn" on:click={() => incrementClap()}>
        <span class="material-symbols-rounded anime"> thumb_up </span>
        {#await getClap()}
          <p class="clapNum">.....</p>
        {:then data}
          <p class="clapNum">{clapNum}</p>
        {/await}
      </div>
      <p class="clapColumn center">Play for free</p>
      <span class="clapColumn material-symbols-rounded"> nest_mini </span>
    </div>
    <h1>{data.skill.name[data.lang]}</h1>
    {#if data.lang === 'en-US' && !data.skill.en}
      <p class="buttonText">\ {data.skill.description[data.lang]} /</p>
      <a target="_blank" rel="noopener noreferrer" href={`${data.skill.aogUrl}?hl=ja-JP`}>
        <span class="material-symbols-rounded text-gradient gradient"> stadia_controller </span>
      </a>
    {:else}
      <p class="buttonText">\ GAME START /</p>
      <a target="_blank" rel="noopener noreferrer" href={`${data.skill.aogUrl}?hl=${data.lang}`}>
        <span class="material-symbols-rounded text-gradient gradient"> stadia_controller </span>
      </a>
      <p class="description">{data.skill.description[data.lang]}</p>
    {/if}
  </div>
</div>

<style>
  .skillWrap {
    display: flex;
    justify-content: center;
  }

  .skill {
    max-width: 1100px;
    width: 100%;
    margin-top: 2rem;
  }

  .hero {
    width: 100%;
    aspect-ratio: 16 / 9;
  }

  .clapWrap {
    display: flex;
    justify-content: center;
    margin-top: 3rem;
  }

  .clapWrap .clapColumn {
    flex: 1;
    justify-content: center;
    display: flex;
    align-items: center;
  }

  .clapWrap span {
    font-size: 3rem;
    width: 3rem;
    overflow: hidden;
  }

  .clapWrap span.anime {
    animation: purun 1s linear infinite;
  }

  .clapWrap .center {
    border-left: 1px solid var(--sub-color-3);
    border-right: 1px solid var(--sub-color-3);
    font-size: 1.5rem;
  }

  .clapWrap .clapNum {
    font-size: 1.5rem;
    margin-left: 1rem;
    min-width: 5rem;
  }

  h1 {
    font-weight: bold;
    font-size: 3rem;
    text-align: center;
    margin-top: 3rem;
  }

  img {
    opacity: 0;
    transition: all 0.5s ease;
  }

  .description {
    margin-top: 3rem;
    line-height: 3.2rem;
    font-size: 1.6rem;
  }

  .buttonText {
    font-size: 1.4rem;
    text-align: center;
    margin-top: 3rem;
  }

  a {
    display: block;
    text-align: center;
    text-decoration: underline;
  }

  .gradient {
    font-size: 8rem;
    border-bottom: 3px solid var(--a-color);
    border-radius: 0.5rem;
    width: 8rem;
    overflow: hidden;
  }

  @media (min-width: 480px) {
    .skill {
      margin-top: 0;
    }

    h1 {
      font-size: 10rem;
    }

    .gradient {
      font-size: 12rem;
      width: 12rem;
    }
  }
</style>
