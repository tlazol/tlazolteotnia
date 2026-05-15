---
title: "クラウド E2E テストプラットフォーム LambdaTest を触ってみる"
date: "2021-07-09"
description: "クラウド E2E テストプラットフォーム LambdaTest の登録から実行までを試した時の操作メモ。"
tags: ["LambdaTest", "E2E"]
draft: false
---
以前から興味のあった LambdaTest を触ってみました。
結果としてはとても優秀なプラットフォームだと感じました。

# LambdaTest とは

タイトルにも書いていますが LambdaTest とはクラウド E2E テストプラットフォームです。最近だと、同様のサービスである Autify を触りましたが、それぞれ特徴があると感じました。

# Google Trend で見てみる

![スクリーンショット 2021-07-09 16.40.30](/images/blog/lambdatest-e2e-platform-01.png)

こうやって見ると BrowserStack がまだまだ強いですね。他の4つは似たりよったりです。

# 触ってみる

## Dashboard

![スクリーンショット 2021-07-09 16.47.24](/images/blog/lambdatest-e2e-platform-02.png)

すっきりとした印象を受けます。好みのデザインです。

## Real time testing

![スクリーンショット 2021-07-09 16.50.09](/images/blog/lambdatest-e2e-platform-03.png)

ブラウザを選んで、その場ですぐに Web サイトを確認する事ができました。しかもそのまま Web サイトを触れます。

![スクリーンショット 2021-07-09 16.49.56](/images/blog/lambdatest-e2e-platform-04.png)

Edge でも見えてますね。良かったです。

## Automation

![スクリーンショット 2021-07-09 16.51.22](/images/blog/lambdatest-e2e-platform-05.png)

ここが LambdaTest の売りな気がします。自分のローカル環境から、いくつかの言語で LambdaTest を直接実行する事ができます。プラットフォームから実行するのではなく、ローカルからなのは便利ですね。

## UI testing

![スクリーンショット 2021-07-09 16.52.11](/images/blog/lambdatest-e2e-platform-06.png)

![スクリーンショット 2021-07-09 16.53.32](/images/blog/lambdatest-e2e-platform-07.png)

これも地味に便利ですね。
複数のブラウザでの表示確認を簡単に行えました。IE11? いえ…知らない子ですね…

## Test Logs

![スクリーンショット 2021-07-09 16.53.48](/images/blog/lambdatest-e2e-platform-08.png)

これまで実施してきたテストが見やすくまとまっています。見やすくていい感じです。

## Integrations

![スクリーンショット 2021-07-09 16.54.07](/images/blog/lambdatest-e2e-platform-09.png)

これもある意味強みですね。とてもたくさんの種類があります。開発をしていると、ツールが変わったりする事もありますから、多くの Integrations があるのはとても嬉しいです。

# おわりに

さくっとですが、触ってみた結果【とても使いやすいが、テストを書くのは開発者に限られる】という印象を受けました。Autify とかですと GUI 上でさくっとテストが作れますので、学習コスト的な面で、開発者に限らず、誰でもテストが作れました。しかし LambdaTest は開発者にとっては、かゆい所にも手が届いてるプラットフォームと言えますので、それぞれ一長一短があると思いました。
