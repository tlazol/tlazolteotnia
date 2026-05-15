---
title: "CSS で上下左右中央揃えにする 5 つの方法"
date: "2021-07-21"
description: "CSS で要素を上下左右中央に揃える 5 つの方法と、それぞれの使いどころを整理したメモ。"
tags: ["CSS", "上下左右中央揃え"]
draft: false
---
こんにちは。CSS 触ってますか？CSS って世界で一番設計が難しいプログラム言語ですよね。

今回は CSS で上下左右中央揃えをする為の方法を5パターン用意してみました。画面の表示はまったく一緒なのにやり方が5つもあるんてなんて素敵な言語でしょうか。

```html
<style>
  .wrap {}
  .box {}
</style>

<div class="wrap">
  <div class="box">
    May the center be with you.
  </div>
</div>
```

こちらの HTML をベースにご紹介していきます。

# 最近の主流のやり方

```html
<style>
  .wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }
</style>

<div class="wrap">
  <div class="box">
    May the center be with you.
  </div>
</div>
```

最近主流のやり方はこれですね。 `display: flex;` に対していくつかのスタイルを適応させて、上下左右中央揃えを実現しています。コンテンツの中身に依らず使えるので、覚えておいて損はないと思います。

# ふた昔ぐらい前のやり方

```html
<style>
  .wrap {
    display: table;
    height: 100vh;
    width: 100vw;
  }

  .box {
    display: table-cell;
    vertical-align: middle;
    text-align: center;
  }
</style>

<div class="wrap">
  <div class="box">
    May the center be with you.
  </div>
</div>
```

そこそこ前のやり方だと、こうですね。 `display: table-cell;` を使うことで上下の中央を指定できるようになるので、ちょっとむりやりですが、上下左右中央揃えを実現できています。

# シンプルだけど使用用途は限られるやり方

```html
<style>
  .box {
    line-height: 100vh;
    text-align: center;
  }
</style>

<div class="wrap">
  <div class="box">
    May the center be with you.
  </div>
</div>
```

これが一番短く上下左右中央揃えを実現できるやり方ですね。 `line-height: 100vh;` で行の高さを画面いっぱいにする事で可能にしています。逆に言えば、中身のコンテンツ次第では実現は出来なくなるので、要注意ですね。

# CSS の仕様と利用したやり方

```html
<style>
  .wrap {
    position: relative;
    height: 100vh;
  }

  .box {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    margin: auto;
    width: 100%;
    height: 1rem;
    text-align: center;
  }
</style>

<div class="wrap">
  <div class="box">
    May the center be with you.
  </div>
</div>
```

こちらは CSS の仕様と利用したやり方ですね。top, right, bottom, left に 0 を指定して margin に auto を指定すると実現できます。何故かと言われれば、そういうものだからという回答になります。

# 比較的新しいやり方

```html
<style>
  .wrap {
    position: relative;
    height: 100vh;
  }

  .box {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
    -webkit-transform: translateX(-50%) translateY(-50%);
  }
</style>

<div class="wrap">
  <div class="box">
    May the center be with you.
  </div>
</div>
```

こちらは `transform` を利用したやり方になっています。top と left に 50% を指定して、ブロックの左上を中央にした後に `transform` で調整してブロックを真ん中に持っていく方法になっています。

# おわりに

いやぁー画面の表示はまったく一緒なのにやり方が5つもあるんてなんて素敵な言語なんでしょう（2回目）ちなみにWeb屋になってもう十数年ですが、いまだに「キレイに CSS の設計ができた！」って思えた事はないです。まだまだ奥が深いですね…！
