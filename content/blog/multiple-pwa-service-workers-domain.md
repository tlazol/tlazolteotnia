---
title: "ひとつのドメインで複数のPWA(Service Worker)を配信する方法"
date: "2020-05-26"
description: "ひとつのドメイン配下で複数の PWA と Service Worker を配信するための構成方法を整理した記事。"
tags: ["domain", "ServiceWorker", "PWA"]
draft: false
---
ひとつのドメインで、複数のPWAを配信し、
各ページを独立して「ホーム画面に追加」する事が出来ましたので、
備忘録的にもアウトプットしておきます。

- example.com/hoge
- example.com/fuga

上記2つのページを、それぞれ独立したPWAとして設定するとします。

# 用意するもの

### hoge用

- example.com/hoge
- example.com/hoge/serviceWorker.js
- example.com/hoge/manifest.json

### fuga用

- example.com/fuga
- example.com/fuga/serviceWorker.js
- example.com/fuga/manifest.json

#### **`各serviceWorker.js`**

```js
self.addEventListener('fetch', (event) => {})
```

#### **`hoge/serviceWorker.js`**

```js
{
  // 中略
  "Scope": "/hoge/",
  "start_url": "/hoge/",
}
```

#### **`fuga/serviceWorker.js`**

```js
{
  // 中略
  "Scope": "/fuga/",
  "start_url": "/fuga/",
}
```

# 以上

気がつければとても単純な事でしたが、
たどり着くまでが、試行錯誤でした。
誰かの助けになれば、幸いです。
