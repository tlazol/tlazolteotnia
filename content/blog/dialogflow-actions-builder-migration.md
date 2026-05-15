---
title: "詳細解説: Dialogflow から Actions Builder への migration 手順"
date: "2020-12-02"
description: "Dialogflow から Actions Builder へ移行する手順を、画面操作と設定の流れに沿って詳しくまとめた記事。"
tags: ["Dialogflow", "Actions Builder", "GoogleAssistant"]
draft: false
---
# このページはなに？
Google アシスタントアクションを、Dialogflow から Actions Builder へ migration したので、その手順をスクリーンショット付きで解説していこうと思います。

# 公式手順
公式の手順は下記のとおりです。（2020/12/2現在）

1. Create a backup of your Dialogflow project by using Dialogflow's export feature.
1. Go to the Actions console and open the project you want to migrate.
1. Navigate to Develop > Actions and click Preview migration.
1. Click through the informational slides and then click Start migration.
1. Choose Migrate as a new project.
1. Review the migration report and optionally download it for future reference.
1. Click Migrate.
1. Enter a name for your "experimental" project and click Create Project. Make a note of the Project ID.
1. Complete any post-migration set up needed and verify your Action is functioning as intended.
1. Use the gactions CLI to pull the draft of your "experimental" project.
1. Reopen your "original" Dialogflow project in the Actions console.
1. Navigate to Develop > Actions and click Preview migration.
1. Choose Migrate this project.
1. Click Migrate.
1. Click the More icon > Project settings and make note of the Project ID.
1. On your local system, open the settings.yaml file of the "experimental" project you pulled, and replace the projectId with the project ID of the "original" project.
1. Use the gactions CLI to push the draft of your locally saved project.
1. Follow the steps for publishing through the alpha or beta channels, or publish your Action to production.

[参考URL](https://developers.google.com/assistant/conversational/project-migration#recommended_migration_process)

順を追って解説していきます。

## Dialogflow のバックアップを作成
まずは、Dialogflowの管理画面にアクセスしてバックアップを取得しましょう。

![スクリーンショット 2020-12-01 14.17.03](/images/blog/dialogflow-actions-builder-migration-01.png)

Dialogflowの管理画面で Export をクリックして、バックアップを取得しておきます。

## Preview migration の開始
次に、Preview migration を実行しましょう。

![スクリーンショット 2020-12-01 14.28.19](/images/blog/dialogflow-actions-builder-migration-02.png)

Actions on Google の管理画面で Develop -> Actions に行き Preview migration をクリックします。

![スクリーンショット 2020-12-01 14.20.05](/images/blog/dialogflow-actions-builder-migration-03.png)

モーダルが開くので Next -> Start migration の順にクリックしていきます。その後出てきた画面で Migrate as a new project を選択し Migrate をクリックしましょう。

（必要があれば Analytics の中身も Export しておきましょう。リセットされますので。）

![スクリーンショット 2020-12-02 11.41.49](/images/blog/dialogflow-actions-builder-migration-04.png)

New Projectが開くので、お好きなマイグレーション用のプロジェクト名をつけて Create Project をクリックします。

## マイグレーション用のプロジェクトを完成させる
マイグレーション用のプロジェクトに Dialogflow からマイグレートされた Actions Builder があると思いますので、それが正常に動作するように、開発を行います。

[こちら](https://developers.google.com/assistant/conversational/fulfillment-migration)を参考に、頑張って開発を終わらせましょう！

## gactions CLI でマイグレーション用のプロジェクトを pull する
頑張って開発が終わったら gactions で作ったプロジェクトをpullして Actions Builder で作ったものを ソースコード化しましょう。

```console
gactions pull --project-id experimental-project-id
```

ついでに Git 等にUPして、バージョン管理もする事をおすすめします。

## 再度 Preview migration を実行する
gactions での pull が終わったら、再度 `オリジナルの方の` Actions on Google の管理画面で Preview migration をクリックしましょう。

Next -> Start migration の順にクリックしていき、

![スクリーンショット 2020-12-01 14.28.55](/images/blog/dialogflow-actions-builder-migration-05.png)

次は Migrate this project を選択して Migrate をクリックしましょう。

## Project IDをメモする
![スクリーンショット 2020-12-01 14.32.10](/images/blog/dialogflow-actions-builder-migration-06.png)
次に `オリジナルの方の` Project ID をメモします。管理画面の右上のメニューから Project settings をクリックして Project ID をコピーしましょう。

## settings.yaml の修正
先程 gactions で pull したソースコードを見ましょう。

settings というディレクトリの中に settings.yaml が入っています。

```console
category: GAMES_AND_TRIVIA
projectId: hogehogehoge
usesDigitalPurchaseApi: true
```

その中の projectId の項目を、先程メモした Project ID に書き換えます。

マイグレーション用に作った Actions Builder を `オリジナルの方に` 上書きするわけです。

## gactions CLI で push する
いよいよ gactions で push して、上書きです。

安心してください。pushしてもリリースされるわけではありません。

```console
gactions push
```

ちなみに、このようなログが出ます。

```console
$ gactions push                                                
Pushing files in the project "hogehogehoge" to Actions Console. This may take a few minutes.
Sending configuration files...
Waiting for server to respond...
[WARNING] Server found validation issues (however, your files were still pushed):
  Locale  Validation Result                                                                                                                       
  en      Could not reserve your pronunciation 'xxxxx' because: Your display name's pronunciation is already reserved by another Action.  
  en      For en: Your sample pronunciations are structured incorrectly.                                                                          
  ja      Could not reserve your pronunciation 'xxxxx' because: Your display name's pronunciation is already reserved by another Action.       
✔ Done. Files were pushed to Actions Console, and you can now view your project with this URL: https://console.actions.google.com/project/xxxxxxxx/overview. If you want to test your changes, run "gactions deploy preview", or navigate to the Test section in the Console.
```

WARNINGも出してくれるし親切ですね。

## リリースする
あとは、α版なり、β版なり、Production版なりを、正規の手順でリリースすれば、完了です。
おめでとうございます！

# 注意点
実際に migration をしてみての知見を共有しておきます。参考になれば幸いです。

## User storage 関連
マイグレーションを行うと User storage がリセットされます。バグっぽいので、現在調査をしてもらっています。ご注意下さい。

## Settings 関連
マイグレーション用のアクション名は `オリジナルの方` と同じだと実機でのテストが出来ません。一時的に別名をつけて開発をしましょう。

## service account key 関連
push 通知送ったり 課金をしたりする際に使用する service account key ですが、少々不便な点もあります。

詳しくは[こちら](https://0rga.org/blog/6ail8uOUIgGa096mngLddY)をご覧下さい。

## Brand verification 関連
![スクリーンショット 2020-12-01 16.06.47](/images/blog/dialogflow-actions-builder-migration-07.png)
マイグレーションを行うと Brand verification の Android apps のチェックが外れます。忘れずに再チェックしましょう。

# おわり
以上、ご参考になれば、幸いです。
楽しい Google アシスタントアクション開発ライフを！
