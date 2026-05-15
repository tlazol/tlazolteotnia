---
title: "Svelte と Express.js で最低限の SSR を実装する"
date: "2020-12-14"
description: "Svelte と Express.js を組み合わせて、最低限の SSR を実装する方法をまとめたメモ。"
tags: ["Svelte", "SSR"]
draft: false
---
この記事は [Svelte Advent Calendar 2020](https://qiita.com/advent-calendar/2020/svelte) 14日目の記事です。

[Svelte](https://svelte.dev/) いいですよね。このサイトも Svelte で構築しています。

![スクリーンショット 2020-12-14 15.55.36](/images/blog/svelte-express-ssr-01.png)

軽いし、実装は楽だし、とても気に入ってます。

Svelte の特徴は、ググったらたくさん出てくると思いますが、なんと言ってもコンパイラである事だと思います。コンパイルすると、ライブラリコードがほぼ無い状態の JavaScript と CSS が作られますので、あとはそれを HTML で読み込めば完成です。このサイトを構築している JS も約80kb程度しかありません。

しかし Svelte で SSR をするには [Sapper](https://sapper.svelte.dev/) or [SvelteKit](https://svelte.dev/blog/whats-the-deal-with-sveltekit) などの追加モジュールのインストールが推奨になっています。

が、なんとなく Svelte だけでさくっと最低限でも SSR をやりたかったので、実装してみました。
その方法のお伝えできればと思います。

# 実装したいもの
Svelte を使用しつつ SSR で head 内の title や meta を生成する。

# とりあえず Svelte で HELLO WORLD! をやってみる
公式サイトに npx が用意されていますので、まずはそれを実行してみましょう。

```console
$ npx degit sveltejs/template my-svelte-project
$ cd my-svelte-project
$ npm install
$ npm run dev
```

![スクリーンショット 2020-12-14 15.44.21](/images/blog/svelte-express-ssr-02.png)

これで Svelte の HELLO WORLD! が完成しました。publicフォルダの index.html を読み込んでいるだけで、動いています。

SSR での HTML コードも見てみましょう。

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset='utf-8'>
	<meta name='viewport' content='width=device-width,initial-scale=1'>

	<title>Svelte app</title>

	<link rel='icon' type='image/png' href='/favicon.png'>
	<link rel='stylesheet' href='/global.css'>
	<link rel='stylesheet' href='/build/bundle.css'>

	<script defer src='/build/bundle.js'></script>
</head>

<body>
</body>
</html>
```

body の中身は Google のクローラーがちゃんと見てくれると信じて meta タグを SSR しましょう。 meta がないと Twitter などに URL を貼ってもサムネなどが出てこなくて寂しいですからね。

root ディレクトリに app.js を作成し Express.js をインストールしましょう。

```console
$ npm i express
```

**app.js**
```js
const express = require('express')
const fs = require('fs')

const app = express()

// static
app.use(`/static`, express.static(`${__dirname}/public/static`, { maxAge: 300 }))
app.use(`/build`, express.static(`${__dirname}/public/build`, { maxAge: 300 }))

// svelte
app.get('*', async (req, res) => {
  const metas = []
  metas.push(`<meta name="description" content="descriptionだよー" />`)
  metas.push(`<meta property="og:url" content="urlだよー" />`)

  const dom = fs.readFileSync(`${__dirname}/public/index.html`)
  res.send(dom.toString().replace('<head>', `<head>\n    ${metas.join('\n    ')}`))
})

app.listen(5000, () => {
  console.log('App listening on port 5000')
})
```

これで、先程と同様に public フォルダの index.html を読み込んでいるだけのサイトが出来ました。

再度 SSR での HTML コードも見てみましょう。

```console
$ node app.js
```

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<meta name="description" content="descriptionだよー" />
	<meta property="og:url" content="urlだよー" />
	<meta charset='utf-8'>
	<meta name='viewport' content='width=device-width,initial-scale=1'>

	<title>Svelte app</title>

	<link rel='icon' type='image/png' href='/favicon.png'>
	<link rel='stylesheet' href='/global.css'>
	<link rel='stylesheet' href='/build/bundle.css'>

	<script defer src='/build/bundle.js'></script>
</head>

<body>
</body>
</html>
```

無事に meta が SSR されました！完成です！

# 何をやっているの？
index.html を返す前に、文字列置換で head タグ内を編集しています。

# 終わりに
正直、ルーティングがない 公式の sample だと「で？」という内容ですが Svelte でちゃんとルーティングがあるサイトを作ろうとすると、この問題に引っかかると思います。

つまりは index.html だけで 複数のページを持つサイトを表現しようと思う時に、この小技が使えると思います。その際は Express.js の req.originalUrl などを見て、動的に meta を書き換える処理を書きましょう。

よかったら、このサイトの SSR での HTML も覗いて見てください。

以上、いい Svelte ライフを！
