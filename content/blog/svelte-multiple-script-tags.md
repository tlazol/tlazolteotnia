---
title: "Svelte に script タグを複数書いて広告タグなどを埋め込む方法"
date: "2021-01-20"
description: "Svelte で複数の `script` タグを書き分け、広告タグなどを埋め込む方法を整理したメモ。"
tags: ["JavaScript", "Svelte"]
draft: false
---
# 追記 2023/3/23

こちらに新しい記事を追加しました。
[SvelteKit で 3rd Party Script を埋め込む 3 つの方法](/blog/5Zlj6lxqbqRZBxpqw7Tf5J)

# 以下、古い記事

このサイトは [Svelte](https://svelte.dev/) で作っています。使いやすいんですよね [Svelte](https://svelte.dev/) 。

Svlete って

```html
<script>
	let name = 'world';
</script>

<h1>Hello {name.toUpperCase()}!</h1>

<style>
  h1 {
    font-weight: 800;
  }
</h1>
```

みたいな感じで script と style と DOM をまとめて書くのですが、例えばここに

```html
<script type="text/javascript">
  const adId = 'xxxx-xxxx-xxxxxxxxxx'
</script>
<script type="text/javascript" src="https://hogehoge.com/ad.js"></script>
```

みたいなよくある広告タグを入れ込もうと思うとエラーになります。

```console
ParseError: A component can only have one instance-level <script> element
```

script タグは一つだけよーと怒られるわけです。

では、どうするかと言うとこうします。

```html
<script>
	let name = 'world';

  const tag1 = document.createElement('script')
  tag1.innerHTML = `const adId = 'xxxx-xxxx-xxxxxxxxxx'`

  const tag2 = document.createElement('script')
  tag2.src = 'https://hogehoge.com/ad.js'

  const adDom = document.getElementById('ad')
  adDom.appendChild(tag1)
  adDom.appendChild(tag2)
</script>

<h1>Hello {name.toUpperCase()}!</h1>
<div id="ad"></div>

<style>
  h1 {
    font-weight: 800;
  }
</h1>
```

script 内で script タグを生成して、埋め込めばOKです。

# おわりに

正直苦肉の策感はありますが、解決方法がほかに考えれませんでした。他にいいやり方をご存知の方、どうか教えてくださいませ…
