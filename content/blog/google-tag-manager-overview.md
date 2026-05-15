---
title: "なんとなく分かる Google Tag Manager"
date: "2020-11-20"
description: "Google Tag Manager の基本概念と導入時に押さえたい考え方をざっくり理解するための記事。"
tags: ["Google Tag Manager", "GTM"]
draft: false
---
# さいしょに

## Google Analytics（GA）ってなに？

言わずとも知れたWebページのアクセス解析サービスです。

奥が深すぎて人間には完全には使いこなせないシンギュラリティ。

ページビューや、クリック計測や、ユーザの属性などなど、色々わかりますので、じっくり見てたら余裕で1日が終わります。

## Google Tag Manager（GTM）ってなに？

シンプルに言えば「タグ」を配信するためのサービスです。

ただ、「タグ」が奥深すぎて、人間には完全には使いこなせない古代文明。

# GTMの事、深堀りしてみましょう

## タグってなに？

一番わかりやすいものでいえば、

`色んな計測サービスや広告サービスで、「このコードをサイトに埋め込んでね」って言われたもの`

を、埋め込めるものです。

直接HTMLを触ることなく、どのページに、なんのコードを埋め込むのか、細やかに設定できます。

（でも、それで終わらないから奥が深いのです…）

## じゃあ結局、GTMってなに？

（基本的には）ソースコードを触ることなく、色んな事が出来ちゃうサービスです。

実際に使い方の例をご紹介しつつ説明していきます。

### GTMの登場人物
![img01](/images/blog/google-tag-manager-overview-01.png)

GTMには、タグ、トリガー、変数などがあります。

#### 変数
![02](/images/blog/google-tag-manager-overview-02.png)

変数とは、開発者には馴染みのある、あの変数です。

上記のようなタイプから選べますので、例として、DOM要素を見てみましょう。

##### 変数 - DOM要素
![03](/images/blog/google-tag-manager-overview-03.png)

DOM要素だと、このような感じになります。

```html
<div
  class="clickEvents"
  data-event-name="焼肉パーティー"
></div>
```

例えばこんなDOMがあった場合にdata-event-nameの中身を抽出できます。

変数名も好きに付けれますので、この変数の名前をclassDataEventLinkとしておきましょう。

#### トリガー
![04](/images/blog/google-tag-manager-overview-04.png)

トリガーとは、「タグ」を配信するタイミングの事です。

上記のようなタイプから選べますので、例として、クリックトリガーを見てみましょう。

##### トリガー - クリックトリガー
![05](/images/blog/google-tag-manager-overview-05.png)

クリックトリガーだと、このような感じになります。

URLに「yakiniku」が含まれており、かつ、クリックしたDOM要素に先程作った変数「classDataEventLink」の要素が含まれており、その値が「焼肉パーティー」だったときのみ、トリガーが引かれる事になります。

このトリガーにはtriggerLinkToEventsと名前をつけましょう。

#### タグ
![06](/images/blog/google-tag-manager-overview-06.png)

そして最後にタグです。

実際に「実行」される事を定義できます。

例として、GAのイベント計測を実行してみましょう。ここで、先程作った、変数とタグをつなぎこみます。

##### タグ - イベント計測
![07](/images/blog/google-tag-manager-overview-07.png)

イベント計測だと、このような感じになります。

トラッキングタイプをイベントにして、
カテゴリやアクションに任意の文字を入れます。
ラベルはclassDataEventLinkを指定し、
トリガーはtriggerLinkToEventsを指定しましょう。

そうすると、

```html
<div
  class="clickEvents"
  data-event-name="焼肉パーティー"
></div>
```

というDOMをクリックした際に、GAに「焼肉パーティー」を押したよ、というイベント計測が渡るようになります。

#### そのほか色々 - タグ
![08](/images/blog/google-tag-manager-overview-08.png)

他にも、このようなタグを作れば、GAのコードを埋め込まずとも、GAにアクセス解析の値は渡ります。

#### そのほか色々 - トリガー
![09](/images/blog/google-tag-manager-overview-09.png)

トリガーとしてスクロール距離なんてものもありますので、ページ下部まで見たユーザ数なんてものも、取ろうと思えば取れます。

### dataLayerとは

このように、HTMLを触らずとも、いろいろな事が出来るGTMですが、もちろんコードでも出来ます。

それがdataLayerです。

dataLayerに色んな情報をpushする事で、いまやった事をコード上で再現できます。

GTMのデバックで見るとわかりますが、例えばGAのページビュー計測だと

```js
dataLayer.push({event: 'gtm.load', gtm.uniqueEventId: 4})
```

このような情報が送られていますし、クリック計測の時も、同様にdataLayerに情報がpushされています。

# おわり

以上、GTMの説明でした。

なんとなーく、取っつきやすくなれば、嬉しいです。
