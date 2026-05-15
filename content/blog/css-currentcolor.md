---
title: "currentColor 便利だよというお話"
date: "2021-02-16"
description: "CSS の `currentColor` を使って色指定を親要素から自然に継承させる便利さを紹介するメモ。"
tags: ["CSS", "color", "currentColor"]
draft: false
---
CSS の [\<color\>](https://developer.mozilla.org/ja/docs/Web/CSS/color_value) に currentcolor という値があります。あまり知られていないようですが使うと便利な値です。

# 例えばよくあるこんな時

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <style>
      div {
        color: #ff0000;
      }
    </style>
  </head>
  <body>
    <div>
      <p>ここはPタグ</p>
      <a href="#">ここはaタグ</a>
    </div>
  </body>
</html>
```

div の中身（ pタグとaタグ ）を全部赤文字にしたいなーと思って div に `color: #ff0000;` を指定しました。でも結果は

![スクリーンショット 2021-02-16 11.18.40](/images/blog/css-currentcolor-01.png)

こんな感じになります。aタグにデフォルトで指定されている色の方が強いからです。こんな時のよくある対処法として愚直に

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <style>
      div {
        color: #ff0000;
      }
      div a {
        color: #ff0000;
      }
    </style>
  </head>
  <body>
    <div>
      <p>ここはPタグ</p>
      <a href="#">ここはaタグ</a>
    </div>
  </body>
</html>
```

と指定する方法がありますが `#ff0000` を 2 回書いているのがちょっと気に入りません。プログラマー的に。

# そんな時は currentcolor の出番

そんなちょっとした `気持ち悪さ` を解消してくれるのが currentcolor です。さっそく使ってみます。

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <style>
      div {
        color: #ff0000;
      }
      div a {
        /* currentColorに変更 */
        color: currentColor;
      }
    </style>
  </head>
  <body>
    <div>
      <p>ここはPタグ</p>
      <a href="#">ここはaタグ</a>
    </div>
  </body>
</html>
```

![スクリーンショット 2021-02-16 11.20.15](/images/blog/css-currentcolor-02.png)

たったこれだけです。実に簡単に違和感なく使えます。color 属性は値が親から子に継承されますので、他のCSS指定に勝つように currentColor を指定するだけです。これなら div の color を変えるだけで一括で子の color も変更できるので、便利で運用しやすいですね。
