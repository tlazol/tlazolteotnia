<script lang="ts">
  import { browser } from '$app/environment'
</script>

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

<style>
  .dmmWrap {
    display: flex;
    justify-content: center;
  }

  .dmm {
    width: 336px;
    height: 280px;
  }

  @media (min-width: 480px) {
    .dmmWrap {
      display: none;
    }
  }
</style>
