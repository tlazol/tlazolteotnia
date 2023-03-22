<script lang="ts">
  import { page } from '$app/stores'

  $: {
    if (typeof gtag !== 'undefined') {
      // eslint-disable-next-line no-undef
      gtag('config', $page.data.gtagId, {
        page_title: document.title,
        page_path: $page.url.pathname
      })
    }
  }
</script>

<svelte:head>
  <script defer src={`https://www.googletagmanager.com/gtag/js?id=${$page.data.gtagId}`}>
  </script>
  {@html `
  <script>
    window.dataLayer = window.dataLayer || []

    function gtag() {
      dataLayer.push(arguments)
    }

    gtag('js', new Date())
    gtag('config', '${$page.data.gtagId}')
  </script>
  `}
</svelte:head>
