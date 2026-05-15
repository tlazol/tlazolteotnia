---
title: "SvelteKit から React Router でサイトをリニューアルした話"
date: "2026-05-15"
description: "SvelteKit で作っていた 0rga.org を React Router で作り直したときの構成、Markdown 移行、UI の作り直しについての記録。"
tags: ["React Router", "React", "SvelteKit"]
draft: false
---
こんにちは。React Router いいですね。

このサイトはしばらく SvelteKit で作っていたのですが、今回 React Router で作り直しました。SvelteKit に大きな不満があったというより、今の自分が触りやすい構成に整理したかった、というのが一番大きいです。

以前のサイトは、SvelteKit の route と Contentful を使ってブログを表示していました。記事一覧は Contentful から取得し、記事詳細では Markdown を HTML に変換して表示する構成です。ギャラリーやゲーム紹介ページ、広告タグ、GTM などもあり、個人サイトとしては少し盛りだくさんになっていました。

今回のリニューアルでは、そこをいったん小さくしました。

# React Router にした

React Router v7 を使っています。ルートはかなりシンプルで、今のところトップページとブログ詳細ページだけです。

```ts:app/routes.ts
import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('blog/:slug', 'routes/blog.$slug.tsx')
] satisfies RouteConfig
```

トップページでは記事一覧を出し、`/blog/:slug` で個別記事を表示します。React Router の `loader` と `meta` に寄せることで、データ取得とメタ情報を route module の中にまとめられるのが気持ちよかったです。

SSR は有効にしています。

```ts:react-router.config.ts
import type { Config } from '@react-router/dev/config'

export default {
  ssr: true
} satisfies Config
```

個人サイトなので SPA だけでも成立しますが、ブログの記事タイトルや description は HTML としてちゃんと返したいので、SSR はそのまま使うことにしました。

# Contentful をやめて Markdown にした

以前は Contentful に記事を置いていましたが、今回は `content/blog` に Markdown ファイルを置く形にしました。

```md
---
title: "Post title"
date: "2026-05-15"
description: "Short description"
tags: ["React", "Diary"]
draft: false
---
```

記事データは `gray-matter` で frontmatter を読み、本文とメタ情報に分けています。トップページでは本文を落として summary だけ返し、詳細ページでは slug に一致する記事を読むだけです。

この構成にしておくと、ブログを書くために外部サービスへ行かなくてよくなります。リポジトリに Markdown を追加すれば記事になるので、サイトのコードと記事が同じ場所で管理できます。

Contentful は便利でしたが、今のこのサイトには少し大きかったです。

# Markdown を React で描画する

記事本文は `marked` で lex して、トークンから React の要素を組み立てる形にしました。

昔の実装では Markdown を HTML に変換して `{@html ...}` で表示していました。今回は React 側で paragraph、heading、list、table、code block、image、link などをそれぞれ描画しています。

リンクと画像は URL を確認してから出すようにしています。

```ts
function isSafeUrl(url: string) {
  try {
    const parsedUrl = new URL(url, 'https://0rga.org')

    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
}
```

個人サイトの Markdown なので大げさな仕組みはいらないのですが、HTML をそのまま流し込むよりは見通しがよくなりました。

# コードブロックをちゃんとした

ブログにはコードを書くことが多いので、コードブロックは少し手を入れました。

シンタックスハイライトには `prism-react-renderer` と `prismjs` を使っています。`json` や `bash` などの言語を追加しつつ、`ts:app/routes.ts` のような info string から言語とファイル名ラベルを分けて表示できるようにしました。

Markdown 側では普通に書けます。

````md
```ts:app/routes.ts
export default [
  index('routes/home.tsx'),
  route('blog/:slug', 'routes/blog.$slug.tsx')
]
```
````

表示側では、ラベル付きのコードブロックになります。記事を書くときにファイル名を添えられるので、あとで読み返したときにも分かりやすいです。

# トップページをブログ中心にした

トップページは、以前の「サイトの入口」っぽい雰囲気から、ブログ一覧を中心にした形に変えました。

大きなヒーローには `Tlazolteotnia` を置き、その下に記事一覧を並べています。タグが一定数以上ある場合はタグフィルタも出るようにしました。

タグフィルタはサーバー側で記事一覧からタグ数を集計し、クライアント側の state で絞り込むだけです。検索やページネーションまでは入れていません。今の記事数ならこれで十分です。

# 見た目も作り直した

デザインは、ターミナルや古いネットワーク機器の画面っぽさを少し混ぜています。

背景は暗く、文字はグリーン寄り。アクセントに青、赤、ピンク、黄色を入れています。以前よりも、個人サイトらしいノイズや癖を前に出しました。

フォントは IBM Plex Mono にしています。コード、日記、作ったもののメモが混ざるサイトなので、モノスペースに寄せたほうが雰囲気が合うと思いました。

Tailwind CSS v4 を使っていますが、コンポーネントライブラリは使っていません。共通で使う class は `app/lib/styles.ts` に逃がして、ページ側では必要な分だけ組み合わせています。

# 減らしたもの

今回のリニューアルでは、機能を足すよりも減らすことを意識しました。

- Contentful 連携をやめた
- 広告コンポーネントを外した
- GTM を外した
- ギャラリーやゲーム紹介ページをいったん外した
- 記事データをローカル Markdown に寄せた

全部を移植することもできましたが、今の自分が更新しやすい状態にするほうを優先しました。個人サイトは、更新する気になれる構成であることがかなり大事です。

# おわりに

SvelteKit から React Router に変えたからサイトが急にすごくなった、という話ではありません。

ただ、コード、記事、見た目、デプロイの単位が自分にとって扱いやすいサイズになりました。ブログを書くなら Markdown を追加するだけ。ルートも少ない。表示も自分で追える。今のサイトにはこれくらいがちょうどよさそうです。

また数年後には別のフレームワークで作り直しているかもしれませんが、それも個人サイトの楽しさだと思います。

# この記事について

この記事の本文は GPT-5 が作成しました。
