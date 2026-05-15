---
title: "max-width を 親に書かないでほしいと言うお話"
date: "2021-03-09"
description: "親要素に `max-width` を置くレイアウトが子要素の自由度を下げる問題を整理した CSS 記事。"
tags: ["CSS", "max-width"]
draft: false
---
タイトル通りの話ですが、最近思う所があったので書きました。

max-width を 親に書かないでほしい。

あと 100 回は言えます。

max-width を 親に書かないでほしい。max-width を 親に書かないでほしい。max-width を 親に書かないでほしい。max-width を 親に書かないでほしい。max-width を 親に書かないでほしい...

どういう事か説明します。

# max-width を親に書く場合

このようなデザインのサイトを作るとします。

![スクリーンショット 2021-03-09 16.42.45](/images/blog/max-width-parent-layout-01.png)

レスポンシブは当然なので、親要素に max-width を指定するのが一番ラクです。

コードで見てみましょう。

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <style>
      .wrap {
        max-width: 600px;
        margin: 0 auto;
      }
      header {
        background: #49d831;
        padding: 1rem;
      }
      footer {
        background: #5597c7;
        padding: 1rem;
        margin-top: 1rem;
      }
      .contents {
        padding: 1rem;
        margin-top: 1rem;
        background: #ffce71;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <p>header</p>
      </header>
      <div class="contents">
        <p>contents 1</p>
      </div>
      <div class="contents">
        <p>contents 2</p>
      </div>
      <div class="contents">
        <p>contents 3</p>
      </div>
      <footer>
        <p>footer</p>
      </footer>
    </div>
  </body>
</html>
```

wrap クラスを持った div が親要素になっていて、そこに max-width が付与されていますね。子要素は親要素に従いきれいに収まっています。

## 何がだめなのか

一見問題なく見えます。きれいに収まってますし、どこがダメなんだよと思う人もいるでしょう。

でもですね、

`デザインの拡張性がクソ` これにつきます。

例えば上記の例で言う「contents 2」だけを横幅いっぱいにしようと思うと、正当な CSS では無理でしょう。

width: 100% と書こうが、 width: 100vw と書こうが無理無理の無理です。

![スクリーンショット 2021-03-09 17.04.19](/images/blog/max-width-parent-layout-02.png)

↑ width: 100vw が付与された悲しい「contents 2」君。

では、どうすればいいのか、それは簡単です。max-width は子要素に付与していきましょう。

# max-width を子に書く場合

まずはソースコードを見てみましょう。

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <style>
      header,
      footer,
      .contents {
        max-width: 600px;
        margin: 0 auto;
      }
      header {
        background: #49d831;
        padding: 1rem;
      }
      footer {
        background: #5597c7;
        padding: 1rem;
        margin-top: 1rem;
      }
      .contents {
        padding: 1rem;
        margin-top: 1rem;
        background: #ffce71;
      }
    </style>
  </head>
  <body>
    <header>
      <p>header</p>
    </header>
    <div class="contents">
      <p>contents 1</p>
    </div>
    <div class="contents">
      <p>contents 2</p>
    </div>
    <div class="contents">
      <p>contents 3</p>
    </div>
    <footer>
      <p>footer</p>
    </footer>
  </body>
</html>
```

こうなります。ブラウザで見ても、

![スクリーンショット 2021-03-09 16.42.45](/images/blog/max-width-parent-layout-01.png)

見た目は同じですね。

wrap なんかいらんかったんや。

これなら「contents 2」だけを横幅いっぱいにというデザイン変更のオーダーも、

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <style>
      header,
      footer,
      .contents {
        max-width: 600px;
        margin: 0 auto;
      }
      header {
        background: #49d831;
        padding: 1rem;
      }
      footer {
        background: #5597c7;
        padding: 1rem;
        margin-top: 1rem;
      }
      .contents {
        padding: 1rem;
        margin-top: 1rem;
        background: #ffce71;
      }
      .full {
        max-width: unset;
        width: 100%;
      }
    </style>
  </head>
  <body>
    <header>
      <p>header</p>
    </header>
    <div class="contents">
      <p>contents 1</p>
    </div>
    <div class="contents full">
      <p>contents 2</p>
    </div>
    <div class="contents">
      <p>contents 3</p>
    </div>
    <footer>
      <p>footer</p>
    </footer>
  </body>
</html>
```

![スクリーンショット 2021-03-09 16.59.44](/images/blog/max-width-parent-layout-03.png)

余裕でなんなく対応できました。

# おわりに

親要素に max-width を付与しようとする人がひとりでも減れば嬉しみです。
