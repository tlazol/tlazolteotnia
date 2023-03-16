<script lang="ts">
  import { lazyLoad } from '$lib/lazyload'
</script>

<div class="galleryWrap">
  <a href="https://www.artstation.com/orga" target="_blank" rel="noopener noreferrer">
    <div class="imgWrap">
      <img
        use:lazyLoad={`https://cdn.artstation.com/artvsartist/orga`}
        alt="My ArtStation"
        loading="lazy"
      />
    </div>
    <p>My artwork here.</p>
  </a>
</div>

<style>
  .galleryWrap {
    display: flex;
    margin-top: 2rem;
    justify-content: center;
  }

  a {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
    max-width: 720px;
    max-height: 780px;
  }

  .imgWrap {
    width: 100%;
    aspect-ratio: 12 / 13;
  }

  img {
    width: 100%;
    opacity: 0;
    transition: all 0.5s ease;
  }

  p {
    line-height: 3.2rem;
    font-size: 1.6rem;
    text-align: center;
  }
</style>
