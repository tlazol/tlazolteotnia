# Tlazolteotnia の TanStack Start 移植 TODO

## 目的

React Router で実装されている `/Users/daisukekobayashi/work/tlazolteotnia` を、TanStack Start のサンプルである `/Users/daisukekobayashi/work/tlazolteotnia_tan` へ完全移植する。

移植元の UI、URL、コンテンツ、HTTP 契約、Cloudflare Workers の設定、D1 リアクション、RSS/Atom、OG 画像生成、セキュリティヘッダー、テストを維持する。

移植元は参照専用とし、実装変更は移植先だけに加える。

## 進捗の更新方法

- 未着手は `[x]`、作業中は `[x]` のまま項目末尾に `（作業中）`、完了は `[x]` とする。
- 親項目は、配下の必須項目がすべて完了してから `[x]` にする。
- 調査で新しい必須作業が判明した場合は、該当する節へチェック項目を追加する。
- 仕様変更が必要になった場合は、実装を進める前に「判断待ち」へ理由と選択肢を記録する。
- コマンドの失敗を未確認のまま完了扱いにしない。

## 固定する仕様

- [x] 移植元のファイルと Git 管理対象を変更していないことを確認する。
- [x] 移植先のスターター UI は置き換え、移植元の見た目と挙動を基準にする。
- [x] 次の公開 URL を維持する。
  - [x] `/`
  - [x] `/blog`（`/` への 301 リダイレクト）
  - [x] `/blog/:slug`
  - [x] `/api/reactions/:slug`
  - [x] `/rss.xml`
  - [x] `/atom.xml`
- [x] ホームのタグ選択を `?topic=<tag>` と同期する。
- [x] ホームの記事選択は URL を変更せずにモーダルを開き、記事直リンクは独立した SSR ページとして表示する。
- [x] D1 のデータ構造、匿名訪問者 Cookie、同一訪問者による同一記事・同一絵文字への重複投票防止を維持する。
- [x] HTML 応答へリクエスト単位の CSP nonce と既存セキュリティヘッダーを付ける。
- [x] Cloudflare の Worker 名、独自ドメイン、D1 binding、database ID、migration directory、observability、source map 設定を維持する。

## 0. 作業開始前の確認

- [x] `AGENTS.md` を読み、TanStack Intent の適用条件を確認する。
- [x] 実装前に、変更対象に対応する TanStack Intent を読み込む。
  - [x] `npx @tanstack/intent@latest load @tanstack/start-client-core#start-core`
  - [x] `npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/execution-model`
  - [x] `npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-functions`
  - [x] `npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-routes`
  - [x] `npx @tanstack/intent@latest load @tanstack/start-client-core#start-core/deployment`
  - [x] `npx @tanstack/intent@latest load @tanstack/router-core#router-core/data-loading`
  - [x] `npx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation`
  - [x] `npx @tanstack/intent@latest load @tanstack/router-core#router-core/search-params`
  - [x] `npx @tanstack/intent@latest load @tanstack/router-core#router-core/not-found-and-errors`
- [x] 両リポジトリの `git status --short` を記録し、既存のユーザー変更を保護する。
- [x] 移植元の `npm run check` が成功することを確認する。
  - [x] 基準は 10 test files、83 tests、43 blog posts、43 OG images である。
- [x] 移植先スターターの `npm run build` が成功することを確認する。
- [x] 移植元を `http://localhost:5173/` で表示し、Playwright で比較用の画面と主要操作を確認する。
- [x] 移植先の動作確認ポートを `3000` とし、移植元の `5173` と同時比較できる状態にする。

## 1. プロジェクト構成と依存関係

- [x] `package.json` を TanStack Start と現行アプリの機能を両立する構成へ更新する。
  - [x] TanStack Start、TanStack Router、React、Cloudflare Vite plugin、Vite、TypeScript、Tailwind CSS を維持する。
  - [x] `feed`、`marked`、`prism-react-renderer`、`prismjs`、`react-icons`、`yaml` を追加する。
  - [x] OG 生成用の `@resvg/resvg-js`、`satori`、`tsx` を追加する。
  - [x] Vitest と既存の lint、format、typecheck、content validation、OG check に必要な開発依存を追加する。
  - [x] 移植後に使わないスターター用 Devtools、Header、Footer、ThemeToggle 関連の依存とコードを削除する。
- [x] npm scripts を移植する。
  - [x] `dev` は Vite を port 3000 で起動する。
  - [x] `build`、`preview`、`deploy`、`deploy:dry-run`、`cf-typegen` を TanStack Start と Cloudflare Workers 用にする。
  - [x] `format`、`format:check`、`fix`、`lint`、`typecheck`、`test`、`test:watch` を用意する。
  - [x] `validate:content`、`og`、`og:check`、`check` を移植する。
- [x] `npm install` で lockfile を更新する。
- [x] `tsconfig.json` の alias を `#/*` に統一し、移植コードの import を合わせる。
- [x] `vitest.config.ts` と `biome.json` を移植先の `src` 構成へ合わせる。
- [x] React Router 固有の package、config、typegen、virtual module を残さない。

## 2. コンテンツと静的資産

- [x] `content/blog` の Markdown 43件を移植する。
- [x] `public/images/blog`、`public/images/paint`、favicon、robots.txt を移植する。
- [x] `migrations/0001_create_reactions.sql` を移植する。
- [x] OG 画像生成スクリプトとフォント資産を移植し、import path を `src` 構成へ合わせる。
- [x] content validation スクリプトを移植し、43記事を検証できるようにする。
- [x] paint image の自動検出 Vite plugin を移植する。
  - [x] 対象拡張子、再帰探索、URL encode、並び順を維持する。
  - [x] production build で画像が0件なら失敗させる。
  - [x] 開発中の画像変更で full reload する。
- [x] `src/virtual-modules.d.ts` など、仮想 module の型定義を TanStack 側へ追加する。

## 3. 共通 UI とスタイル

- [x] `app/app.css` を `src` 配下へ移植する。
- [x] Tailwind CSS 4 の読み込みと content detection が、移植した全 component と route を対象にすることを確認する。
- [x] 共通 component を `src/components` へ移植し、import と Router API だけを変更する。
  - [x] Community layout、shell、navigation、profile footer、back link、tag list。
  - [x] Home timeline、post modal、Markdown body、code block。
  - [x] Reaction bar、article reaction footer。
- [x] `react-router` の `Link` を `@tanstack/react-router` の `Link` へ置き換える。
- [x] 内部 link の `to` と path parameter が TanStack Router の型検査を通るようにする。
- [x] 外部 URL は通常の `<a>` を維持する。
- [x] 記事モーダルの次の挙動を維持する。
  - [x] 通常クリックだけを modal open として intercept する。
  - [x] modifier key、別 tab、別 window の navigation を妨げない。
  - [x] modal open 中は body scroll を固定する。
  - [x] Escape、backdrop click、close button で閉じる。
  - [x] open 時に close button へ focus し、close 後に元の要素へ戻す。
  - [x] modal の記事本文とリアクションを非同期に読み込む。
- [x] リアクション UI の optimistic update、送信中表示、失敗時 rollback、picker の keyboard 操作を維持する。
- [x] 移植元に存在する responsive layout と desktop/mobile の sidebar 表示を維持する。

## 4. 共通ライブラリとサーバー境界

- [x] `app/lib` の client-safe module を `src/lib` へ移植する。
  - [x] 記事型、frontmatter validation、タグ、site metadata、styles、accent、identity。
  - [x] Markdown parsing と安全な URL allowlist。
  - [x] Reaction emoji allowlist、sort、merge。
  - [x] Paint background と post modal 判定。
- [x] 記事読み込み、feed 生成、D1 操作を `.server.ts` module へ分離する。
- [x] route loader から server-only module を直接実行せず、`createServerFn` を経由する。
- [x] server function の入力を validator で検証する。
  - [x] 記事 slug。
  - [x] Reaction slug と emoji。
- [x] ホーム loader 用 server function を実装する。
  - [x] 公開記事 summary を新しい順で返す。
  - [x] 全記事の reaction counts と訪問者自身の reacted state を返す。
  - [x] D1 読み込み失敗時は記事を表示し、reaction map を空として処理する。
  - [x] `Cache-Control: private, no-store` と必要な visitor Cookie を設定する。
- [x] 記事 loader 用 server function を実装する。
  - [x] 本文、全記事 summary、reaction を返す。
  - [x] 未知の slug は TanStack Router の `notFound()` として扱う。
  - [x] D1 読み込み失敗時も本文を表示し、reaction だけ空にする。
- [x] modal 用の記事取得 server function を共通化し、route loader と記事 parsing を重複させない。
- [x] server function を追加する場合は、TanStack Start の標準 CSRF middleware が有効な構成を維持する。

## 5. TanStack Router のルート

- [x] root route を移植する。
  - [x] `<html lang="en">`、`HeadContent`、`Outlet`、`Scripts` を正しく配置する。
  - [x] favicon、RSS/Atom alternate link、Google Fonts の preconnect と stylesheet を head に追加する。
  - [x] paint background を SSR loader data から表示し、hydration mismatch を起こさない。
  - [x] 現行と同等の error component と global not-found component を追加する。
- [x] `/` route を実装する。
  - [x] `topic` search parameter を検証し、未指定時は空文字として扱う。
  - [x] `Route.useLoaderData()` から記事と reaction map を取得する。
  - [x] title と description を現行値にする。
- [x] `/blog` route を実装し、status 301 で `/` へ redirect する。
- [x] `/blog/$slug` route を実装する。
  - [x] slug を loader へ渡す。
  - [x] title、description、canonical 相当の Open Graph URL、OG image、Twitter card を loader data から生成する。
  - [x] reaction state を page 内で更新できるようにする。
  - [x] home と `?topic=` 付き home への navigation を維持する。
- [x] route generator を実行し、`src/routeTree.gen.ts` を生成する。
- [x] 生成後、route tree を手編集していないことを確認する。

## 6. 公開 server routes

- [x] `/api/reactions/$slug` を TanStack Start の server route として実装する。
  - [x] GET は `{ reactions, reactedEmojis }` を返す。
  - [x] GET は `Cache-Control: private, no-store` を付ける。
  - [x] GET の D1 障害時は status 200 と空配列を返す。
  - [x] POST は FormData の `emoji` を allowlist で検証する。
  - [x] POST は `{ reaction, created }` を返す。
  - [x] 不正 emoji は 400、未知の記事は 404、保存障害は 503 と日本語 error message を返す。
  - [x] GET と POST の必要な応答へ visitor Cookie を追加する。
- [x] `/rss.xml` と `/atom.xml` を literal-dot の server route として実装する。
  - [x] 43件の公開記事を新しい順で含める。
  - [x] summary と Markdown から生成した全文 HTML を含める。
  - [x] 相対 URL を `https://0rga.org` の絶対 URL にする。
  - [x] RSS は `application/rss+xml; charset=utf-8` を返す。
  - [x] Atom は `application/atom+xml; charset=utf-8` を返す。
  - [x] `Cache-Control: public, max-age=3600` を返す。

## 7. Cloudflare Workers とセキュリティ

- [x] `worker-configuration.d.ts` を最新の `wrangler types` で生成し、`DB` と `REACTION_COOKIE_SECRET` を型付けする。
- [x] custom server entry を実装する。
  - [x] Cloudflare の `fetch(request, env, ctx)` から TanStack Start handler を呼ぶ。
  - [x] D1、Cache API、reaction secret、bound 済み `ctx.waitUntil`、CSP nonce を request context に渡す。
  - [x] request context の module augmentation を追加し、型 cast に依存しない。
- [x] reaction count cache を維持する。
  - [x] cache key は origin ごとの `/__cache/reaction-counts-v1` とする。
  - [x] slug 一覧が一致した cache だけを利用する。
  - [x] TTL は60秒とする。
  - [x] 新しい reaction 作成時に cache を削除する。
  - [x] cache write は `waitUntil` へ登録し、失敗を記録する。
- [x] visitor Cookie を維持する。
  - [x] Cookie 名は `reaction_visitor` とする。
  - [x] 32-byte random value の base64url 表現を使う。
  - [x] `HttpOnly`、`SameSite=Lax`、`Path=/`、2年の `Max-Age` を付ける。
  - [x] HTTPS の場合だけ `Secure` を付ける。
  - [x] Cookie の生値を D1 に保存せず、secret を使った HMAC-SHA-256 hash を保存する。
- [x] HTML response の nonce を TanStack Router の SSR option へ渡し、`HeadContent` と `Scripts` が同じ nonce を使うことを確認する。
- [x] HTML response に次の header を設定する。
  - [x] `Content-Security-Policy`
  - [x] `X-Content-Type-Options: nosniff`
  - [x] `Referrer-Policy: strict-origin-when-cross-origin`
  - [x] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - [x] `Strict-Transport-Security: max-age=31536000`
- [x] production CSP に `unsafe-eval` を含めず、development の localhost HTTP/WebSocket だけを許可する。
- [x] `wrangler.jsonc` を現行の本番値へ更新する。
  - [x] Worker name は `tlazolteotnia`。
  - [x] compatibility date は `2026-07-02` 以降の実装日と整合させる。
  - [x] `nodejs_compat` を維持する。
  - [x] `workers_dev: false`、`preview_urls: true` を維持する。
  - [x] custom domain `0rga.org` を維持する。
  - [x] D1 binding `DB` と既存 database ID を維持する。
  - [x] observability と source map upload を維持する。

## 8. 自動テストの移植

- [x] 既存の 10 test files と 83 tests を移植する。
- [x] blog post parsing、frontmatter validation、slug、draft exclusion、sort のテストを通す。
- [x] blog tag、site URL、post identity、paint background のテストを通す。
- [x] Markdown の HTML 無効化、URL allowlist、table、code highlighting のテストを通す。
- [x] RSS/Atom の件数、順序、URL、Content-Type、Cache-Control のテストを通す。
- [x] reaction の allowlist、sort、merge のテストを通す。
- [x] D1 service のテストを React Router の `RouterContextProvider` から plain な typed runtime dependency へ変更する。
- [x] reaction server test で次を検証する。
  - [x] 同一訪問者の100並列 duplicate request でも1件だけ作成する。
  - [x] 訪問者、記事、emoji ごとに投票を分離する。
  - [x] secure Cookie と reacted state を復元する。
  - [x] 不正 emoji と未知の記事を拒否する。
  - [x] count cache の hit、miss、invalidation、`waitUntil` を検証する。
- [x] TanStack route/server function/server route 固有のテストを追加する。
  - [x] `/blog` の 301 redirect。
  - [x] 未知の記事と lesson の 404。
  - [x] API の GET/POST response shape と status。
  - [x] HTML security headers とリクエストごとに変わる nonce。

## 9. 静的検証とビルド

- [x] `npm run format:check` を通す。
- [x] `npm run lint` を通す。
- [x] `npm run typecheck` を通す。
- [x] `npm test` を通す。
- [x] `npm run validate:content` が43記事を検証する。
- [x] `npm run og:check` が43 OG images を検証する。
- [x] `npm run build` を通す。
- [x] `npm run deploy:dry-run` を通す。
- [x] production client bundle を調べ、次を確認する。
  - [x] `REACTION_COOKIE_SECRET` や D1 binding の値が含まれない。
  - [x] `.server.ts` の D1 SQL と server implementation が client chunk に含まれない。
  - [x] `react-router` と `@react-router/dev` が bundle と依存関係に残らない。

## 10. Playwright と HTTP の同等性確認

- [x] `http://localhost:5173/` の移植元と `http://localhost:3000/` の移植先を同じ viewport で比較する。
- [x] desktop でホームの server rail、channel navigation、timeline、details sidebar を比較する。
- [x] mobile で横スクロール、文字切れ、modal の viewport 超過がないことを確認する。
- [x] ホームの43記事と topic count が移植元と一致する。
- [x] JavaScript topic を選ぶと `?topic=JavaScript` になり、6記事だけ表示する。
- [x] 記事を通常クリックすると URL を変えずに modal が開き、本文を表示する。
- [x] modal の「Open post page」から `/blog/:slug` へ遷移する。
- [x] 記事直リンクの SSR HTML、title、description、OG/Twitter meta を確認する。
- [x] reaction picker を mouse と keyboard で操作する。
- [x] test 用 D1 または明示的な mock 環境で reaction POST、optimistic update、再読み込み後の reacted state を確認する。
- [x] browser console の error と warning が0件であることを確認する。
- [x] HTTP response を確認する。
  - [x] `/` は 200、HTML、security headers、visitor Cookie を返す。
  - [x] `/blog` は 301 と `Location: /` を返す。
  - [x] `/blog/<known-slug>` は 200 と記事固有の metadata を返す。
  - [x] 未知の URL、記事、lesson は 404 を返す。
  - [x] reaction API は `private, no-store` と既存 JSON contract を返す。
  - [x] RSS/Atom は XML body と既存 Content-Type を返す。
  - [x] 連続する2回の HTML request で CSP nonce が異なる。

## 11. 自己レビューと完了処理

- [x] `self-code-review` skill を読み、変更全体をレビューする。
- [x] 変更行が移植に必要なものだけであることを確認する。
- [x] server/client boundary、Cookie、CSP、D1 query、cache invalidation を重点レビューする。
- [x] `rg` で React Router 固有参照とスターター固有表示の残存を検索する。
  - [x] `react-router`
  - [x] `@react-router/dev`
  - [x] `TanStack Start Starter`
  - [x] starter の `Header`、`Footer`、`ThemeToggle`
- [x] `git diff --check` を通す。
- [x] 最終の `git status --short` を確認し、build artifact、秘密情報、`.dev.vars` を commit 対象へ含めない。
- [x] 全検証をもう一度実行し、失敗がないことを確認する。
- [x] この TODO の完了項目を更新する。
- [x] 完了報告に次を記載する。
  - [x] 移植した機能と主要な TanStack Start への置換点。
  - [x] 実行した検証と結果。
  - [x] 手動確認が必要な本番 D1、secret、domain、deploy 作業。
  - [x] 残課題がある場合は、再現条件と次の作業。

## 判断待ち

現時点ではなし。

新しい判断が必要になった場合は、次の形式で追記する。

```md
- [x] 判断事項：何を決める必要があるか
  - 背景：実装だけでは決められない理由
  - 選択肢：候補と影響
  - 推奨：既存仕様を最も維持する案
```

## 完了条件

- [x] 0節から11節までの必須項目がすべて完了している。
- [x] 公開 URL、画面、操作、HTTP contract、Cloudflare 設定が移植元と同等である。
- [x] format、lint、typecheck、83件以上の test、content validation、OG check、production build、deploy dry-run が成功する。
- [x] Playwright と HTTP の同等性確認が完了し、browser console error がない。
- [x] 移植元に変更がなく、移植先に秘密情報や不要な build artifact が含まれていない。
