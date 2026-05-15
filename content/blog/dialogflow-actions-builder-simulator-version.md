---
title: "Dialogflow から Actions Builder への migration した後に 管理画面のシミュレーターでバージョンを戻せなくなる時の対処法"
date: "2021-05-20"
description: "Dialogflow から Actions Builder へ移行後、シミュレーターで旧バージョンに戻せない時の対処法。"
tags: ["Dialogflow", "Actions Builder", "migration"]
draft: false
---
Actions Builder が出てから久しく経ちましたね。Dialogflow から Actions Builder へ migration をされた人も多いと思います。

migration 時に大切なのが既存ユーザのデータ移行テストですよね。Dialogflow 版で遊んでいたユーザのユーザストレージのデータが Actions Builder 版でも正常に引き継ぎされているかどうか確認する事はとても重要です。

シミュレーターでは テストするバージョンが選べますので、その機能を使えばデータ引き継ぎテストは簡単にできます。

# 起動しないシミュレーター

しかし migration を実行した後に、シミュレーターで Dialogflow 版を起動しようとすると、起動できません。起動するには下記手順が必要になります。

## アクションのページにアクセスしてユーザデータをリセットする

![スクリーンショット 2021-05-20 11.20.26](/images/blog/dialogflow-actions-builder-simulator-version-01.png)

[アクションのページ](https://assistant.google.com/services/a/uid/00000043d8be414e?hl=ja)にアクセスするとページ最下部に `リセット` というリンクがあるので、クリックしてユーザデータをリセットします。  
__※ユーザデータが消えますので十分に考慮してから実行してください。__

## シミュレーターでバージョンを指定する

![スクリーンショット 2021-05-20 10.41.32](/images/blog/dialogflow-actions-builder-simulator-version-02.png)

ユーザデータをリセットしたらシミュレーターの Settings でバージョンを指定しましょう。

## 起動する

そしたら、あとは通常どおり、実機で起動するなり、シミュレーターで起動するなりで、好きな方を選びましょう。

リセットという方法でしかバージョンを切り替えれないのは不便ですが、この方法を知らないともっと不便ですので、お困りの際は試してみてください。
