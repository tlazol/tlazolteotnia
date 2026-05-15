---
title: "SvelteKit で 3rd Party Script を埋め込む 3 つの方法（ChatGPT代筆版）"
date: "2023-03-27"
description: "ChatGPT に依頼して作成した、SvelteKit で 3rd Party Script を読み込む方法の解説記事。"
tags: ["SvelteKit", "3rd Party Script"]
draft: false
---
先日 [SvelteKit で 3rd Party Script を埋め込む 3 つの方法](/blog/5Zlj6lxqbqRZBxpqw7Tf5J) という記事を書きましたが、記事の内容を読ませた ChatGPT により具体的に、より良い記事になるように校正させてみました。

わかっていたことですが、自分で書いた内容より読みやすいしわかりやすいですね。

# ChatGPT とのやりとり

```
Q. 以下の文章を読んで、追記したほうが良い事や、より具体的な記述を教えて下さい。
A. [ChatGPT の回答]
Q. ありがとう。では上記指摘をさらに具体的にして、代わりに全部書き直してください。
```

# 以下 ChatGPT の回答

このサイトは SvelteKit というJavaScriptのフレームワークで作成されています。最近、バージョン 1.0.0 からバージョン 1.5.0 にアップグレードしました。新しいバージョンでは、以前のバージョンと比べて書き方が大きく変更されており、アップグレード作業はとても楽しかったです。

特に、+page.svelte +page.server.ts を使用することで、サーバーサイドのロジックを分離することができるようになり、開発体験が向上しました。

アップグレードの過程で、SvelteKitにサードパーティスクリプトを埋め込む方法についていくつかの知見を得ましたので、ここで紹介します。

SvelteKitでは、複数のスクリプトタグを直接書くとエラーが発生するため、次のような方法で埋め込みます。

# svelte:headを使う方法

```html
<script lang="ts">
  import { assets } from '$app/paths'
</script>

<svelte:head>
  <script defer src="{assets}/example.js"></script>
</svelte:head>
```
これは、一般的な方法です。svelte:headの中にはスクリプトタグを直接書くことができるため、この方法でスクリプトを読み込むことができます。

# svelte:headと@htmlを組み合わせる方法

```html
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

上記のコードは、GTMのタグを埋め込む例です。スクリプトをsrc属性ではなく直接書いて、その中でSvelteで定義した変数を使用したい場合、@htmlと組み合わせる必要があります。

# browserを使う方法

```html
<script lang="ts">
  import { browser } from '$app/environment'
  import { assets } from '$app/paths'
</script>

{#if browser}
  <script defer src="{assets}/example.js"></script>
{/if}
```

3つ目の方法は、browser 変数を使用する方法です。browser 変数は、現在の環境がブラウザであるかどうかを示します。この方法では、svelte:head を使用する代わりに、if ブロックで条件分岐してスクリプトを挿入します。ただし、この方法ではサーバーサイドでスクリプトが実行されず、クライアントサイドでのみ実行されることに注意してください。

以上の3つの方法がありますが、svelte:head を使用する方法が最も一般的な方法であり、特に外部スクリプトの読み込みには便利です。ただし、他の方法も場合によっては有用な場合があります。

Svelteは非常に柔軟で、開発者が自由に選択できる方法が多数あります。
