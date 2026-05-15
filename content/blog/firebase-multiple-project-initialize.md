---
title: "ひとつのアプリで複数の Firebase プロジェクトを使う時の Initialize のやり方"
date: "2021-01-14"
description: "ひとつのアプリから複数の Firebase プロジェクトを初期化して使う方法をまとめたメモ。"
tags: ["JavaScript", "Firebase", "Cloud Firestore"]
draft: false
---
備忘録も兼ねて書きます。

Firebase 便利ですよね。このサイトでも Cloud Firestore を使用しています。そして、ひとつのアプリで複数の Firebase プロジェクトを使う時は、2つめからはユニークな名前を付ける必要があります。

でも、どのプロジェクトがひとつめなのかは、人間が管理する事ではありません。Firebase JavaScript SDK を使用して、このように書きましょう。

```js
const firebase = require('firebase-admin')
const serviceAccountKey = require('./ServiceAccountKey.json')
const project = firebase.apps.length === 0
  ? firebase.initializeApp(
      {
        credential: firebase.credential.cert(serviceAccountKey),
      }
    )
  : firebase.initializeApp(
    {
      credential: firebase.credential.cert(serviceAccountKey),
    },
    'hoge'
  )
const firestore = project.firestore()
```

これで、もしも1つめのプロジェクトでなければ hoge という名前を付ける事ができます。知っていると簡単な事なのですが、知らないと意外と悩んでしまうと思います。

誰かの助けになれば、幸いです。
