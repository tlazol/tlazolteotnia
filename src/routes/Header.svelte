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
        <a
          href="https://www.artstation.com/orga"
          target="_blank"
          rel="noopener noreferrer"
          class={$page.url.pathname === '/gallery' ? 'on' : undefined}
        >
          <span class="material-symbols-rounded"> magic_button </span>
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
    top: 0;
    display: flex;
    justify-content: center;
    width: 100vw;
    border-bottom: 1px solid var(--sub-color-3);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
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
