---
title: "React Router から TanStack Start に移行した話"
date: "2026-08-28"
description: "React Router で作っていた個人サイトを TanStack Start へ移行した。型付きルーティング、Server Function、Cloudflare Workers との接続がどう変わったのかをまとめた記録。"
tags: ["TanStack Start", "React Router", "Cloudflare"]
draft: false
---

こんにちは。TanStack Start、いいですね。

このサイトは 2026 年 5 月に SvelteKit から React Router へ移行したばかりだが、今度は TanStack Start へ移行した。
落ち着きがない。

React Router に大きな不満があったわけではない。
SSR もできるし、loader も使えるし、Cloudflare Workers でも動いていた。
ブログとして必要な機能は、すでにそろっていた。

それでも TanStack Start を触ってみたかった。
新しいものは実際に使ってみないと、自分にとって何がよいのか分からない。
どうせ試すなら、サンプルアプリではなく、D1、Cookie、RSS、OG 画像、CSP まで載っている実際のサイトを移行したほうがよい。

ということで、やってみた。

## TL;DR

見た目と公開 URL は、ほとんど変わっていない。

中では、URL、検索パラメーター、データ取得、Cloudflare Workers の実行環境が、TanStack Start の型でつながるようになった。

一番よかったのは、フレームワークを変えたら急に高速になったことではない。
どのコードがブラウザで動き、どのコードがサーバーだけで動くのかを、実装としてはっきり分けられたことだ。

## ルートをファイルで定義する

React Router 版では、公開する URL を `app/routes.ts` にまとめていた。

```ts:app/routes.ts
import { index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('api/reactions/:slug', 'routes/api.reactions.$slug.ts'),
  route('rss.xml', 'routes/rss.xml.ts'),
  route('atom.xml', 'routes/atom.xml.ts'),
  route('blog', 'routes/blog.tsx'),
  route('blog/:slug', 'routes/blog.$slug.tsx')
]
```

ルート数が少ないので、この形でも特に困ってはいなかった。
一覧を一か所で見られるのも分かりやすい。

TanStack Start 版では、それぞれのファイルが自分の URL を宣言する。

```tsx:src/routes/blog.$slug.tsx
export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => {
    return requireRouteData(
      await getPostData({ data: { slug: params.slug } })
    )
  },
  head: ({ loaderData }) => ({
    meta: getPostMeta(loaderData?.post)
  }),
  component: BlogPost
})
```

ファイルから `routeTree.gen.ts` が生成され、ルート全体の型になる。
記事ページの `slug` も、リンクから `loader` まで同じルート定義を通る。

リンクの書き方も変わった。

```tsx
<Link
  to="/blog/$slug"
  params={{ slug: post.slug }}
>
  {post.title}
</Link>
```

以前は `` `/blog/${post.slug}` `` という文字列を作っていた。
新しい形では、`to` に必要なパラメーターを渡し忘れると TypeScript が止めてくれる。

タイプミスで存在しない URL を作っても、ブラウザでクリックするまで気づけない。
その確認をコードを書いた時点に移せるのは、地味だけれど助かる。

## 検索パラメーターにも型を付ける

トップページでは、`?topic=JavaScript` のような検索パラメーターで記事を絞り込んでいる。

React Router 版では `useSearchParams()` から値を取り出していた。
`URLSearchParams` なので、取得できる値は当然ながら文字列か `null` である。

TanStack Start 版では、ルート側で検索パラメーターを検証する。

```tsx:src/routes/index.tsx
export const Route = createFileRoute('/')({
  validateSearch: (
    search: Record<string, unknown>
  ): { topic?: string } => ({
    topic:
      typeof search.topic === 'string' && search.topic
        ? search.topic
        : undefined
  }),
  loader: () => getHomeData(),
  component: Home
})
```

コンポーネント側では、検証済みの値を受け取れる。

```tsx
const { topic: selectedTag = '' } = useSearch({ from: '/' })
```

遷移するときも、URL を手で組み立てない。

```tsx
navigate({
  to: '/',
  search: { topic: tag.name }
})
```

パスだけでなく検索パラメーターまでルートの型に含まれる。
URL が文字列ではなく、アプリケーションのデータ構造として扱われる感じがよい。

## loader とサーバー処理を分ける

今回の移行で一番考えたのは、`loader` の中身だった。

TanStack Start のコードは、何もしなければサーバーとクライアントの両方で動く可能性がある。
ルートの `loader` もサーバー専用とは限らず、クライアント遷移時にはブラウザで実行される。

つまり、`loader` から D1 や秘密値を扱うコードを直接呼ぶわけにはいかない。
サーバーでしか動かしてはいけない処理は、`createServerFn` の内側へ置く。

```ts:src/lib/blog.functions.ts
export const getPostData = createServerFn({ method: 'GET' })
  .validator(validateSlug)
  .handler(async ({ context, data }) => {
    const result = await loadPostData(
      context,
      getRequest(),
      data.slug
    )

    applyPrivateHeaders(result?.cookie)

    if (!result) return null

    return {
      post: result.post,
      posts: result.posts,
      reactions: result.reactions
    }
  })
```

記事の `slug` は `validator` で検証し、Markdown の読み込みや D1 への問い合わせは `.server.ts` のファイルへ分けた。
ブラウザからは普通の TypeScript 関数のように呼べるが、実際の処理は Cloudflare Workers 側で実行される。

最初は「`loader` から関数を呼ぶだけなのに、一段増えるのか」と思った。
しかし、D1 へ触れる場所と画面へデータを渡す場所が分かれたことで、むしろ追いやすくなった。

関数名を見るだけで、サーバーとの通信が発生する場所も分かる。

## 記事モーダルの無駄を減らす

トップページの記事を普通にクリックすると、URL を変えずにモーダルが開く。
別タブで開いた場合や「記事ページを開く」を押した場合は、`/blog/:slug` の独立したページへ移動する。

この動きは移行前から変えていない。

React Router 版では、モーダルの記事を取得するために `useFetcher()` から記事ページの `loader` を呼んでいた。

```tsx
postFetcher.load(`/blog/${post.slug}`)
```

記事ページの `loader` は、本文、リアクション、サイドバーに使う全記事の概要を返す。
モーダルには全記事の概要が必要ないのに、同じ `loader` を使う都合で一緒に取得していた。

TanStack Start 版では、モーダル専用の Server Function を作った。

```ts
export const getModalPostData = createServerFn({ method: 'GET' })
  .validator(validateSlug)
  .handler(async ({ context, data }) => {
    const result = await loadPostData(
      context,
      getRequest(),
      data.slug,
      false
    )

    if (!result) return null

    return {
      post: result.post,
      reactions: result.reactions
    }
  })
```

画面が必要とするデータだけを返せるようになり、記事ページの都合をモーダルへ持ち込まずに済むようになった。

ただし、モーダルではリアクション API も別に読み直している。
Server Function の結果にもリアクションは含まれているため、通信をもう少し整理できる余地は残っている。

作り直すと、こういう小さな無駄にも気づく。

## Cloudflare Workers の依存を普通のオブジェクトにする

このサイトのリアクション機能は、Cloudflare D1、Cache API、Cookie 用の秘密値、`waitUntil` を使っている。

React Router 版では、これらを `RouterContextProvider` に登録し、context token を使って取り出していた。

```ts
context.get(dbContext)
context.get(reactionCountsCacheContext)
context.get(reactionSecretContext)
context.get(waitUntilContext)
```

TanStack Start 版では、必要な値を一つの型付きオブジェクトにした。

```ts:src/lib/cloudflare-context.ts
export type RuntimeDependencies = {
  db: D1Database
  reactionCountsCache: Cache | null
  reactionCookieSecret: string
  waitUntil: ExecutionContext['waitUntil'] | null
}
```

利用する側は普通にプロパティを読む。

```ts
const db = context.db
const cache = context.reactionCountsCache
```

専用の context token を知らなくても、型を見るだけで必要な依存が分かる。
テストでも `RuntimeDependencies` と同じ形のオブジェクトを作ればよくなり、フレームワーク固有の Provider を組み立てる必要がなくなった。

テストコードから型キャストがかなり減ったのも嬉しい。

## API と RSS もファイルルートに置く

画面だけでなく、リアクション API、RSS、Atom も TanStack Start のファイルルートにした。

```tsx:src/routes/api.reactions.$slug.ts
export const Route = createFileRoute('/api/reactions/$slug')({
  server: {
    handlers: {
      GET: ({ context, params, request }) =>
        handleGetReactions(context, request, params.slug),
      POST: ({ context, params, request }) =>
        handlePostReaction(context, request, params.slug)
    }
  }
})
```

RSS はもっと短い。

```tsx:src/routes/rss[.]xml.ts
export const Route = createFileRoute('/rss.xml')({
  server: {
    handlers: {
      GET: () => createBlogFeedResponse('rss')
    }
  }
})
```

生の HTTP レスポンスが必要な場所は Server Route、React の画面から型付きで呼びたい場所は Server Function という分け方になった。
どちらも裏側では同じサーバー処理を呼ぶため、API と画面で D1 の処理を重複させずに済む。

## SSR とセキュリティヘッダーを維持する

フレームワーク移行で怖いのは、新しい機能を入れることより、今まで動いていたものを静かに壊すことだ。

このサイトでは、記事ページの SSR、`title`、`description`、OGP、RSS、Atom、D1 リアクション、匿名訪問者の Cookie を維持する必要があった。
HTML レスポンスには、リクエストごとに異なる CSP nonce も付けている。

TanStack Start 版では、Cloudflare Workers のエントリーポイントで nonce を作り、ルーターの SSR 設定へ渡してから、HTML レスポンスへセキュリティヘッダーを追加している。

```ts:src/server.ts
const nonce = createCspNonce()

const response = await startHandler(request, {
  context: {
    db: env.DB,
    reactionCountsCache: await caches.open('reaction-counts'),
    reactionCookieSecret: env.REACTION_COOKIE_SECRET,
    waitUntil: ctx.waitUntil.bind(ctx),
    nonce
  }
})
```

Playwright と HTTP レスポンスで、次の挙動を確認した。

- トップページは記事一覧を含む SSR HTML を返す
- 記事の直リンクは本文と記事固有のメタ情報を返す
- `/blog` は `/` へ 301 リダイレクトする
- 存在しない記事は 404 になる
- 記事クリックでは URL を変えずにモーダルが開く
- HTML レスポンスには CSP nonce と既存のセキュリティヘッダーが付く
- RSS と Atom はこれまでと同じ URL で取得できる

TanStack Start へ変えたことで、これらが新しくできるようになったわけではない。
React Router 版でも動いていた。

同じ挙動を保ったまま、TanStack Start のルート、Server Function、Cloudflare Workers の `handler` へ置き換えられたことに意味がある。

## 遷移先を先読みする

ルーターには、リンクを操作しようとした段階で遷移先を先読みする設定を入れた。

```ts:src/router.tsx
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0
})
```

ホバーやフォーカスをした時点で必要なコードとデータの読み込みを始められるため、記事ページを開いたときの待ち時間を短くできる。
戻る操作では、スクロール位置もルーターが復元する。

とはいえ、移行前後で表示速度を計測したわけではない。
「TanStack Start にしただけでサイトが高速化した」と書くと、それは言い過ぎになる。

モーダルへ不要な全記事データを返さなくなったことは確認できる。
ルーターの先読みも有効にした。
今の時点で言えるのはそこまでだ。

## 減らしたもの

移行に合わせて、実験的に置いていた Lean 学習ページをいったん外した。

そのため、この変更はフレームワークの完全な一対一置換ではない。
ブログ、リアクション、フィードなど現在公開しているサイトの機能を移し、使っていなかった学習ページは持っていかなかった。

個人サイトなので、全部を残すことより、今の自分が触る範囲を小さく保つほうを優先した。
以前の SvelteKit から React Router への移行でも似たことをしている。

どうやら自分は、フレームワークを移行するたびにサイトを少しずつ掃除するらしい。

## おわりに

React Router から TanStack Start へ変えたから、サイトの見た目が急に豪華になったわけではない。
訪問した人から見れば、たぶん何も変わっていない。

自分がコードを触るときには、かなり違う。

存在しない URL は型検査で見つかる。
検索パラメーターもルートの型になる。
D1 や秘密値を扱う処理は Server Function の向こう側にある。
Cloudflare Workers の依存は、普通の型付きオブジェクトとしてテストできる。

このサイトには、この分かれ方が合っている。

また数か月後に別のフレームワークへ移行している可能性はある。
そのときは、たぶんまた「実際に触ってみないと分からない」と言っていると思う。

## この記事について

前の記事では「この文章を添削して」という指示を我慢して終わった。

今回は最初から Codex に書かせている。
人間の決意は、だいたい三日坊主である。
