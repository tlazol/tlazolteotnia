<script lang="ts">
  import { onMount } from 'svelte'
  import './3rdParty.css'

  onMount(() => {
    const $nendAdDom = document.getElementById('nendAd')

    if ($nendAdDom) {
      const $lonbNendNet = document.querySelector('script[src*="/lonb.nend.net/"]')
      if ($lonbNendNet) {
        $lonbNendNet.remove()
      }
      const $nendAcquiredIds = document.getElementById('nend_acquired_ids_342563_1014532')
      if ($nendAcquiredIds) {
        $nendAcquiredIds.remove()
      }
      const $nendImpressionCountUrl = document.querySelector('img[alt="nend_impression_count_url"]')
      if ($nendImpressionCountUrl) {
        $nendImpressionCountUrl.remove()
      }

      const tag1 = document.createElement('script')
      tag1.innerHTML = `var nend_params = {"media":67423,"site":342563,"spot":1014532,"type":10,"oriented":1};`
      const tag2 = document.createElement('script')
      tag2.async = true
      tag2.src = 'https://js1.nend.net/js/nendAdLoader.js'

      $nendAdDom.appendChild(tag1)
      $nendAdDom.appendChild(tag2)
    }
  })
</script>

<div id="nendAd" />

<style>
  #nendAd {
    aspect-ratio: 8 / 6;
  }

  @media (min-width: 480px) {
    #nendAd {
      display: none;
    }
  }
</style>
