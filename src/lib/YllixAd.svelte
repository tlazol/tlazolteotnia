<script lang="ts">
  import { browser } from '$app/environment'
</script>

<svelte:head>
  <script
    src="https://cdnjs.cloudflare.com/ajax/libs/postscribe/2.0.8/postscribe.min.js"
    async
  ></script>
</svelte:head>

<div id="yllixAd" />

{#if browser}
  <script>
    if (postscribe) {
      postscribe(
        '#yllixAd',
        '<script src="https://udbaa.com/bnr.php?section=General&pub=939356&format=300x250&ga=g"></script>'
      )
    }
  </script>
{/if}
