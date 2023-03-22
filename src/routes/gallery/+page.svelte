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
    <div class="textWrap">
      <p>My portfolio is here.</p>
      <span class="material-symbols-rounded"> outbound </span>
    </div>
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
    background-color: var(--img-background-color);
  }

  img {
    width: 100%;
    opacity: 0;
    transition: all 0.5s ease;
  }

  .textWrap {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 1rem;
  }

  .textWrap p {
    line-height: 3.2rem;
    font-size: 2rem;
    font-weight: bold;
    text-align: center;
    text-decoration: underline;
  }

  .textWrap span {
    line-height: 3.2rem;
    font-size: 2rem;
    width: 3rem;
    overflow: hidden;
  }
</style>
