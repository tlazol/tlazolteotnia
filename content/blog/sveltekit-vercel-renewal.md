---
title: "SvelteKit + Vercel でサイトをリニューアルした話"
date: "2022-01-05"
description: "SvelteKit と Vercel でサイトをリニューアルした時の技術選定、実装、所感をまとめた記録。"
tags: ["SvelteKit", "Vercel"]
draft: false
---
こんにちは。Svelte いいですよね。

このサイトは Svelte + ConoHa で作っていたのですが SvelteKit + Vercel でリニューアルしました。

# なぜ Svelte + ConoHa をやめたのか

理由はひとつです。ConoHa の CentOS7 で SvelteKit が動かなかったから。以上。

Svelte にも ConoHa にも不満はありませんでしたが、いかんせんもう CentOS7 が古い。そして CentOS がちょっと自分には合わなくなってきたので、いい機会なので乗り換えました。

CentOS7 に色々インストールしてやっていってもよかったんですが、ちょっとそのモチベーションはもうありませんでした。サーバをイジイジするの、好きだったんですが。

# SvelteKit + Vercel でリニューアル

## SvelteKit

### for me

- やっぱり軽い
- 今まで Express.js + Svelte + Page.js でルーティングとSSRしていたので、びっくりするほど開発が簡単になった
- ようやく手に入れたファイルシステムベースのルーティング
- adapter という概念でデプロイする形式をサクッと変更できる
- sveltekit:prefetch が素敵
- \[slug\].json.ts が素敵
- TypeScript で書く意義が増えた

### not for me

- adapter の説明が少なすぎる
- 別の module との相性が悪かったりする
- load function がややこしい

## Vercel

### for me

- 色々言われているだけあって早い。サイトのパフォーマンスが向上
- 基本的にブランチ連携するだけ簡単
- domain 設定も楽ちん
- わかりやすい UI

### not for me

- VPS と違って、サーバに色々インストール出来るわけではない
- Vercel 上では動かない Node.js の module があった
- Firebase が動かないなどの issue も上がっており、まだまだこれから感がある
- 無料プランがどこまでやれるのかの懸念

# おわりに

いろいろあげましたが、作ってて楽しい技術でしたので、素晴らしいフレームワークだと思います。
