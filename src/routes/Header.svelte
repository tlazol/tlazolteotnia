<script lang="ts">
  import { page } from '$app/stores'
</script>

<header>
  <nav>
    <ul>
      <li>
        <a href="/" class={$page.url.pathname === '/' ? 'on' : undefined}>
          <span class="material-symbols-rounded"> house </span>
        </a>
      </li>
      <li>
        <a href="/gallery" class={$page.url.pathname === '/gallery' ? 'on' : undefined}>
          <span class="material-symbols-rounded"> photo_library </span>
        </a>
      </li>
      <li>
        <a href="/skill" class={$page.url.pathname.startsWith('/skill') ? 'on' : undefined}>
          <span class="material-symbols-rounded"> stadia_controller </span>
        </a>
      </li>
      <li>
        <a href="/blog" class={$page.url.pathname.startsWith('/blog') ? 'on' : undefined}>
          <span class="material-symbols-rounded"> description </span>
        </a>
      </li>
    </ul>
  </nav>
</header>

<style>
  header {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: center;
    width: 100vw;
    background-color: var(--main-background);
    border-top: 1px solid var(--sub-color-3);
  }

  nav {
    width: 100vw;
    max-width: 800px;
  }

  ul {
    display: flex;
  }

  li {
    flex: 1;
    justify-content: center;
    display: flex;
    padding: 1rem 0;
  }

  a {
    display: flex;
  }

  .on {
    color: var(--key-color);
    font-weight: bold;
    text-decoration: underline;
  }

  .material-symbols-rounded {
    font-size: 2.5rem;
    padding: 1rem;
    width: 4.5rem;
    overflow: hidden;
  }
</style>
