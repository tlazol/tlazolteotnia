---
title: "NightmareJSとphantomJSとpuppeteerのパフォーマンス検証してみた"
date: "2018-01-29"
description: "リリース後5分以内に重要なURLへe2eテストを行うため、主要なヘッドレスブラウザのパフォーマンスを検証したメモ。"
tags: ["JavaScript", "Node.js", "PhantomJS", "nightmarejs", "puppeteer"]
draft: false
---

# このページはなに？

リリース後5分以内に重要なURL（100個程度）に対してe2eテストが出来る技術を探したいのです。
あと、ヘッドレスブラウザが沢山あるので、主要どころは触ってみたいという動機も。

# 登場言語

- phantomJS
  - Webkitベースのヘッドレスブラウザ。開発も止まりブラウザのバージョンが古いのでモダンなデザインが崩れてきました。phantomJS2も出たのでそちらなら大丈夫かもしれません。
- NightmareJS
  - Phantom.jsのラッパー。内部ブラウザとしてElectronを採用しています。
- puppeteer
  - ヘッドレスChromeを操作するnodeモジュールです。

# 検証方法

YahooのTOPにアクセスし、画面キャプチャを取得し、終了するまでの時間を計測します。
プログラムコードは最小単位で。通信速度はほぼ一定。

# 結果

![phantomJS、NightmareJS、puppeteerの計測結果](/images/blog/nightmarejs-phantomjs-puppeteer-performance.png)

# 結論

pupeteerが一番パフォーマンスが良かったので採用します。1.0.0もリリースされましたし。
NightmareJSがphantomJSより遅かったのが面白かったです。phantomJSよりソースコードを簡略にリーダブルに記述できるけどElectronが重いのかな…？
