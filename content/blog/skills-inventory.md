---
title: "Skills の棚卸しするぞい！"
date: "2026-10-21"
description: "AI エージェントに入れている Skills を一覧にして、いまの自分に必要なものを考える。"
tags: ["AI", "Skills", "Codex"]
draft: false
---

これまでたくさんのスキルを入れてきた。

そのときのモデルでは有効だったからだ。

でもいまは Astra や Opus がいる。もういまの AI モデルには不要なスキルがあるはずだ。

よし、棚卸しだ。

# いま入っているスキル

| スキル名 | 概要 | Git URL |
| --- | --- | --- |
| `agents-sdk` | Cloudflare Workers 上で、状態を持つ AI エージェントやチャットアプリを作る。 | [cloudflare/skills](https://github.com/cloudflare/skills) |
| `appllama-app-design-skill` | Expo / React Native で、モバイルアプリの画面や操作感を作り込む。 | [appllama/appllama-skills](https://github.com/appllama/appllama-skills) |
| `cloudflare` | Workers、D1、R2 など、Cloudflare のサービスを使った開発を支援する。 | [cloudflare/skills](https://github.com/cloudflare/skills) |
| `cognitive-rhythm-writing` | 説明文の緩急を整えて、単調な文章を読み進めやすくする。 | [k16shikano / Gist](https://gist.github.com/k16shikano/eb2929f13ed19c97188393d297be8432) |
| `frontend-design` | Web の画面を作るときに、配色や文字、レイアウトに意図を持たせる。 | [anthropics/skills](https://github.com/anthropics/skills) |
| `hatch-pet` | Codex 用のアニメーションペットを作り、画像の組み立てや検証を行う。 | 導入元未確認 |
| `japanese-tech-writing` | 日本語の技術文書を書くときに、段落や論理、言い回しを整える。 | [k16shikano / Gist](https://gist.github.com/k16shikano/fd287c3133457c4fd8f5601d34aa817d) |
| `karpathy-guidelines` | 過剰な実装や無関係な変更を避け、必要な変更と検証に集中する。 | [swarmclawai/andrej-karpathy-skills](https://github.com/swarmclawai/andrej-karpathy-skills) |
| `mine` | ローカルのセーブデータで遊ぶ、放置型の採掘 CLI ゲーム。 | [tlazol/cli-dwarf-mine](https://github.com/tlazol/cli-dwarf-mine) |
| `orca-cli` | Orca のワークツリー、ターミナル、埋め込みブラウザなどを操作する。 | [stablyai/orca](https://github.com/stablyai/orca) |
| `playwright-cli` | ブラウザを操作して、Web ページの表示や動作を確認する。 | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) |
| `proofreading` | 元の文章を大きく変えず、誤字や表記、文法の引っかかりを直す。 | [tlazol/skills](https://github.com/tlazol/skills) |
| `quiz-the-plan` | AI が提案した実装計画を、一問ずつ進む理解確認のクイズにする。 | [tlazol/skills](https://github.com/tlazol/skills) |
| `security-audit` | コードのセキュリティを調べ、脆弱性の根拠や検証結果をまとめる。 | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) |
| `self-code-review` | コードを変更した後に差分を見直し、必要な修正と検証をする。 | [tlazol/skills](https://github.com/tlazol/skills) |
| `speaker-first-slides` | 登壇者の話を主役にして、1 枚につき 1 話題の発表スライドを作る。 | [tlazol/skills](https://github.com/tlazol/skills) |
| `wrangler` | Cloudflare の CLI で、デプロイや各サービスの操作を行う。 | [cloudflare/skills](https://github.com/cloudflare/skills) |

うーん。予想よりたくさん入っていた。しかも内容がかぶっているものもある。

# 不要なスキルを整理する

とりあえず

- `appllama-app-design-skill`
- `self-code-review`
- `hatch-pet`

を消そう。

# 悩むスキル

- `karpathy-guidelines`

これが曲者。むかし入れたときは、たしかに AI が作るコードのクオリティが上がったのを実感できた。

しかし Astra や Opus の時代に、これ必要なんか…？

スキル化していちいち指示しなくても、意識してくれるのではないか？

うーむ。

とりあえず消してだめだったら戻そう。
