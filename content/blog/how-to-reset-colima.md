---
title: "ローカルにインストールしている Docker daemon（Colima）が macOS 更新のたびに落ちるから備忘録を残すスレ"
date: "2026-07-22"
description: "macOS の更新後に Colima が起動しなくなった場合の復旧手順をまとめたメモ。毎回落ちるのやめてほしい。"
tags: ["Colima", "Docker", "macOS"]
draft: false
---

## Colima とは

Colima は、macOS 上で Docker などのコンテナランタイムを動かすための CLI ツール。

macOS では、Linux 用の Docker daemon を直接実行できない。

そのため、Colima は内部で Lima を利用して軽量な Linux 仮想マシンを起動し、その仮想マシン内で Docker daemon を動かす。

## Colima の再起動手順

### Colima の状態を確認

```console
% colima status
FATA[0000] colima is not running
```

### Colima の起動を試行

```console
% colima start
INFO[0001] starting colima
INFO[0001] runtime: docker
INFO[0006] starting ...                                  context=vm
> Using the existing instance "colima"
> errors inspecting instance: [vz driver is running but host agent is not]
FATA[0006] error starting vm: error at 'starting': exit status 1
```

### Colima を強制停止

```console
% colima stop -f
INFO[0000] stopping colima
INFO[0000] stopping ...                                  context=vm
INFO[0001] done
```

### Colima を起動

```console
% colima start
INFO[0001] starting colima
INFO[0001] runtime: docker
INFO[0003] starting ...                                  context=vm
INFO[0022] provisioning ...                              context=docker
INFO[0023] starting ...                                  context=docker
INFO[0025] done
```

以上。

どうせ次の OS 更新でまた落ちているはずなので、その時このメモを見る予定。
