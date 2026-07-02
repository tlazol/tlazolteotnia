# Cloudflare Workers 移行TODO

現在、Cloudflare Workersランタイムを使った `npm run dev`、型チェック、Lint、プロダクションビルドまでは動作している。
以下の項目を上から順に進める。

## P0：デプロイを妨げる可能性がある処理の移行

- [x] 現在のOGP画像生成を廃止する
  - [x] OGP画像ルートを削除する
  - [x] 記事メタデータから生成画像のURLを削除する
  - [x] OGP画像URLの生成処理を削除する
  - [x] `@vercel/og` とOGP専用フォントを削除する
  - [x] 古いOGP画像URLが404を返し、通常の記事表示に影響しないことを確認する

- [x] Markdownのfrontmatter解析をWorkers向けに整理する
  - [x] `gray-matter` 由来の直接 `eval` 警告がデプロイや実行に影響するか確認する
  - [x] 影響する場合は、ビルド時のfrontmatter解析またはWorkers互換のパーサーへ置き換える
  - [x] 全記事の件数、本文、日付、タグ、下書き除外が移行前と一致することを確認する

- [x] Cloudflare向けの検証用npm scriptsを追加する
  - [x] `preview` を追加する
  - [x] `deploy` を追加する
  - [x] `wrangler deploy --dry-run` を含む検証コマンドを追加する
  - [x] dry runでWorkerのバンドル、静的アセット、アップロードサイズを確認する

## P1：Cloudflareの実行環境を本番仕様にする

- [x] Cloudflareの型定義を生成してTypeScriptへ組み込む
  - [x] `wrangler types` の実行方法をnpm scriptへ追加する
  - [x] Workerエントリ、環境変数、bindings、`ExecutionContext` を型付けする
  - [x] 生成型と `workers/` をTypeScriptの検査対象に含める

- [x] WorkerエントリからReact RouterへCloudflareコンテキストを渡す
  - [x] `env` と `ctx` をrequest handlerへ渡す
  - [x] bindingsを追加した場合にloaderやactionから型安全に参照できる構成にする

- [x] `wrangler.jsonc` の本番設定を確定する
  - [x] Worker名を確定する
  - [x] `compatibility_date` と `compatibility_flags` を確認する
  - [x] Observabilityとsource mapの設定を決める
  - [x] KV、D1、R2などを使う場合はbindingsを追加する
  - [x] Workers.devとカスタムドメインのroute方針を決める

## P2：NodeおよびVercel固有の構成を整理する

- [x] Node用の起動構成をCloudflare向けに変更する
  - [x] `start` の `react-router-serve` を削除またはCloudflare向けコマンドへ変更する
  - [x] 使用箇所を確認して `@react-router/node` を削除する
  - [x] 使用箇所を確認して `@react-router/serve` を削除する

- [x] Vercel固有の残存設定を整理する
  - [x] Vercel用の環境変数、CI設定、ホスティング設定が残っていないか確認する

- [x] `Dockerfile` の用途を確認する
  - [x] Cloudflare移行後に用途がなければ削除する
  - [x] 別の実行環境で使う場合はCloudflare用の手順と分離する

## P3：デプロイと切り替えを検証する

- [x] プロダクション相当環境で主要画面を確認する
  - [x] トップページを確認する
  - [x] ブログ一覧とタグ絞り込みを確認する
  - [x] 記事詳細を確認する
  - [x] 記事メタデータに削除済みのOGP画像URLが含まれていないことを確認する
  - [x] 404レスポンスを確認する
  - [x] CSP、静的画像、フォント、キャッシュヘッダーを確認する

- [ ] Workers.devへ試験デプロイする
  - [x] CloudflareアカウントとWranglerの認証を設定する
  - [ ] 試験URLでログとエラーを確認する
  - [x] 本番データや外部サービスを使う場合は環境変数とsecretsを設定する（該当なし）

- [ ] カスタムドメインをCloudflare Workersへ切り替える
  - [ ] DNSとroute設定を準備する
  - [ ] 切り替え前後のレスポンスとキャッシュを確認する
  - [ ] 問題発生時の切り戻し手順を用意する

- [ ] 移行完了後の不要構成を削除する
  - [ ] Vercel側のデプロイを停止する
  - [ ] 不要になった環境変数とsecretsを削除する
  - [ ] READMEまたは運用手順をCloudflare向けに更新する

## 保留：OGP画像の再設計

- [ ] Cloudflare移行の完了後にOGP画像の要件と実装方式を検討する
  - [ ] 静的生成とリクエスト時生成を比較する
  - [ ] フォント、キャッシュ、画像サイズ、更新方法を決める
  - [ ] 実装後に記事メタデータへOGP画像URLを戻す
