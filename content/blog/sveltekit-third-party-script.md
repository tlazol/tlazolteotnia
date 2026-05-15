---
title: "SvelteKit で 3rd Party Script を埋め込む 3 つの方法"
date: "2023-03-23"
description: "SvelteKit で広告タグなどの 3rd Party Script を埋め込むための代表的な 3 つの方法を整理したメモ。"
tags: ["SvelteKit", "3rd Party Script"]
draft: false
---
このサイトは SvelteKit で作っているのですが、最近 ver 1.0.0 から ver 1.5.0 にアップグレードしました。書き方が大きく変わっていて、とても楽しいマイグレーションでした。

特に `+page.svelte` `+page.server.ts` でサーバサイドのロジックを分離できるのはよき開発体験でした。

マイグレーション時に SvelteKit に 3rd Party Script を埋め込む方法をいくつか知見として得たのでアウトプットします。

SvelteKit では普通に script タグを複数書いてしまうと

```
ParseError: A component can only have one instance-level <script> element
```

とエラーが起きますので。

# svelte:head を使う

```javascript
<script lang="ts">
  import { assets } from '$app/paths'
</script>

<svelte:head>
  <script defer src="{assets}/example.js"></script>
</svelte:head>
```

これが一番オーソドックスな方法かもしれません。
svelte:head の中には script タグが書けるので、この方法で読み込むことができます。

# svelte:head と @html の合せ技
```javascript
<svelte:head>
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
```

例えば上記コードは GTM のタグを埋め込むソースですが script を src ではなく直書きし、かつその中で svelte での変数を使用したい場合は @html との合せ技を使用します。これに気づくまで結構時間がかかりました。

# browser を使う

```javascript
<script lang="ts">
  import { browser } from '$app/environment'
  import { assets } from '$app/paths'
</script>

{#if browser}
  <script defer src="{assets}/example.js"></script>
{/if}
```

svelte:head ではなく browser を使用しても可能です。この場合 SSR ではなく CSR で読み込まれる事になります。

以上 3つ が主な方法になると思います。
Svelte でよい開発体験をできますように。
