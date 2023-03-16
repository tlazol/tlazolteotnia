<script lang="ts">
  import { assets } from '$app/paths'
  import type { PageData } from './$types'
  import './prism.css'
  export let data: PageData

  const getDateJa = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString()
  }
</script>

<svelte:head>
	<script defer src="{assets}/prism.js"></script>
</svelte:head>

<div class="wrap">
  <div id="blogWrap">
    <div class="title">{data.blogEntry.fields.text}</div>
    <div class="date">{getDateJa(data.blogEntry.fields.date)}</div>
    {@html data.blogEntry.fields.markdown}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    justify-content: center;
  }

  #blogWrap {
    max-width: 1100px;
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
    margin-bottom: 2rem;
    color: var(--sub-color);
  }

  @media (min-width: 480px) {
    .title {
      font-size: 8rem;
      line-height: 10rem;
      margin-top: 5rem;
    }
  }
</style>
