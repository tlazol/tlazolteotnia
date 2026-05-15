---
title: "Cypress で Form を操作した時に「Whoops, there is no test to run.」と出る時の対処法"
date: "2021-04-15"
description: "Cypress で form 操作時に `Whoops, there is no test to run.` が表示される原因と対処法のメモ。"
tags: ["Cypress"]
draft: false
---
Cypress いいですよね。オールインワンのE2Eテストフレームワークなのでテストを書くことだけに集中できます。超絶おすすめです。

さて、先日いつものように E2E テストを書いていた時に Cypress が落ちてしまいました。

![スクリーンショット 2021-04-15 16.01.25](/images/blog/cypress-form-whoops-no-test-01.png)

調査していくとどうやら Form を操作した時に落ちるみたいです。そこまではすぐに分かったのですが、全然原因が分かりませんでした。めちゃくちゃハマって悩んで、ようやく原因と対応が分かったので、メモを残しておきます。

# Form に target="_top" などが設定されていると落ちる

原因はこれでした。[issues](https://github.com/cypress-io/cypress/issues/3121) も上がっていました。しかしまさか target が原因だとは思わず、なかなか絞ることができませんでした。

## 対応方法

こちらの対応方法はいろいろありますが、一番楽だなと思ったのは、submit する前に target を直接書き換えてしまう方法です。

```js
cy.window().then((window) => {
  window.document.querySelector('form').setAttribute('target', '_self')
})
cy.get('form').submit()
```

このような感じで target の値を直接別のものに変えてから submit をする事で Cypress がクラッシュする事を防げます。
