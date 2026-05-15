---
title: "Google アシスタントアクションを、ActionsBuilderにマイグレートする際のtransactionsでの注意点"
date: "2020-11-04"
description: "Actions Builder へ移行する際の transactions 設定で注意したい点をまとめたメモ。"
tags: ["GoogleAssistant", "ActionsBuilder"]
draft: false
---
jwtClientで使用する、service account keyは、
マイグレーション時に作られた新規プロジェクトではなく、
元のプロジェクトで発行しないと、

```js
error: {
  status: "PERMISSION_DENIED"
  message: "The caller does not have permission"
  code: 403
}
```

となりますので、ご注意を。

クソ嵌ったので共有しておきます。

### 追記: 2020/11/3

entitlement:consumeで、消費アイテムを消費する際のアクセストークンは、
新規プロジェクトのservice account keyで発行しないと、

```console
status: 403
statusText: 'Forbidden'
```

になりますので、ご注意を。

要は

```console
skus:batchGet でゲーム内アイテムを取得する際は、旧プロジェクトのservice account key
entitlement:consume で購入した消費アイテムを消費する際は、新プロジェクトのservice account key
```

ですね。
