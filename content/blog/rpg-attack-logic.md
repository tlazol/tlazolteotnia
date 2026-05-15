---
title: "「たたかう」のロジックをコードで考える"
date: "2021-02-10"
description: "RPG の「たたかう」処理を題材に、攻撃対象やダメージ計算のロジックをコードで考えるメモ。"
tags: ["Node.js", "RPG", "「たたかう」"]
draft: false
---
[勇者と逆さまの塔](https://0rga.org/skill/brave)も、[バトルマシン](https://0rga.org/skill/robo)も、[デモンズダンジョン](https://0rga.org/skill/demon)も、RPGです。

そして、RPGといえば「たたかう」です。その「たたかう」のロジックを考えてみましょう。

# ただのなぐりあいのロジック

例えば、こんな勇者とゴブリンがいます。

```js
const hero = { // 勇者
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30, // 攻撃力
  def: 10 // 防御力
}

const goblin = { // ゴブリン
  maxHp: 100,
  hp: 100,
  maxMp: 0,
  mp: 0,
  atk: 20, // 攻撃力
  def: 5 // 防御力
}
```

この2人に殴り合いをしてもらいましょう。
ダメージ計算式は、偉大な[アルテリオス計算式](https://dic.nicovideo.jp/a/%E3%82%A2%E3%83%AB%E3%83%86%E3%83%AA%E3%82%AA%E3%82%B9%E8%A8%88%E7%AE%97%E5%BC%8F)を採用します。

```js
const hero = {
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30,
  def: 10,
}

const goblin = {
  maxHp: 100,
  hp: 100,
  maxMp: 0,
  mp: 0,
  atk: 20,
  def: 5,
}

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtkDamage = hero.atk - goblin.def
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  if (goblin.hp > 0) {
    const goblinAtkDamage = goblin.atk - hero.def
    hero.hp -= goblinAtkDamage
    console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

```console
勇者のHP: 100  ゴブリンのHP: 100
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 90  ゴブリンのHP: 75
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 80  ゴブリンのHP: 50
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 70  ゴブリンのHP: 25
勇者の攻撃、ゴブリンに25のダメージ!
勇者の勝ち！
```

勇者が hp を 70 残した状態で勝ちますね。でも、これでは色々と考慮がたりません。もっと考えてみましょう。

# 両者ともカッチカチの場合の殴り合いは永久に

例えば、勇者とゴブリンがお互いに防御力に特化していたら、どうなるでしょうか。

```js
const hero = {
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30,
  def: 999, // カッチカチ
}

const goblin = {
  maxHp: 100,
  hp: 100,
  maxMp: 0,
  mp: 0,
  atk: 20,
  def: 999, // カッチカチ
}

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtkDamage = hero.atk - goblin.def
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  if (goblin.hp > 0) {
    const goblinAtkDamage = goblin.atk - hero.def
    hero.hp -= goblinAtkDamage
    console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

答えは簡単、無限ループします。お互いにダメージがマイナスになる為、HPが0以下にならないからです。

このままでは、勇者の攻撃力より高い防御力を持った敵が現れた場合、バグと化してしまいます。対応策は色々とありますが、ここでは最低保障ダメージシステムを採用しましょう。意味は読んでそのままです。

```js
const hero = { ...略 }

const goblin = { ...略 }

const damageCalculator = (offense, defense) => {
  const damage = offense - defense // 攻撃力 - 防御力
  const least = Math.round(offense / 10) // 最低保証ダメージ(攻撃力の1/10)
  if (damage < least) {
    return least
  }
  return damage
}

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtkDamage = damageCalculator(hero.atk, goblin.def)
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  if (goblin.hp > 0) {
    const goblinAtkDamage = damageCalculator(goblin.atk, hero.def)
    hero.hp -= goblinAtkDamage
    console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

```console
勇者のHP: 100  ゴブリンのHP: 100
勇者の攻撃、ゴブリンに3のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 98  ゴブリンのHP: 97
勇者の攻撃、ゴブリンに3のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
:
:
中略
:
:
勇者のHP: 36  ゴブリンのHP: 4
勇者の攻撃、ゴブリンに3のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 34  ゴブリンのHP: 1
勇者の攻撃、ゴブリンに3のダメージ!
勇者の勝ち！
```

これで攻撃力の1/10のダメージは最低でも通るようになりましたので、いずれ決着がつくようになりました。

しかしこれでは「はぐれメタル」系の敵がいる場合、圧倒的にモンスターに不利になりますので、その場合は最低保証ダメージを 1 にするといいでしょう。

これで単純に殴り合う最低限のロジックができました。次はスキルについて考えてみましょう。これだけだと、ただただ脳筋が勝つゲームになってしまいます。

# 主人公のスキルよりモンスターのスキルの方が多彩説

まずはスキルについて、色々と考えてみましょう。スキルと一言に言ってもたくさんあります。

- 体力を回復する回復系スキル（アクティブ）
- 強い力で敵を攻撃する強撃系スキル（アクティブ）
- 毒などの状態以上にする特殊スキル（アクティブ）
- 敵の攻撃を一定確率で避けるスキル（パッシブ）
- 味方をかばうスキル（パッシブ）
- パーティにいるだけで味方or敵のステータスが増減するスキル（パッシブ）
- 敵味方全員のスキルを無効にするスキル（パッシブ）

などなど、スキルは無限にあります。これをどうロジックに落としていくか考えてみましょう。問題は、スキルの内容や発動タイミングが多岐に渡るということです。

もしあなたがスキルを実装するとしたらどうやりますか？

# さすが遊戯王

自分の場合、色々と考えた結果、「たたかう」に、下記のようなフェイズを作ることにしました。

- スタートフェイズ（一番最初にスキルが発動する）
- セットフェイズ（戦闘開始時にスキルが発動する）
- アタックフェイズ（攻撃側のスキルが発動する）
- ディフェンスフェイズ（防御力側のスキルが発動する）
- ダメージ計算フェイズ（実際のダメージが計算される）
- アタックアフターフェイズ（ダメージ計算後に攻撃側のスキルが発動する）
- ディフェンスアフターフェイズ（ダメージ計算後に防御側のスキルが発動する）
- ダメージ発生フェイズ（上記の流れを元に計算されたダメージがHPから引かれる）

これぐらいのフェイズを設定してあげると、そこそこ複雑なスキルでもロジックを実装することが出来ました。ちなみに後から気がついたんですが、これほぼ遊戯王のターン進行と同じなんですよね。自分なりに知恵を絞った結果だったんですが、さすが遊戯王。

ではこれを、実際のロジックに落としてみましょう。

## 強撃系スキルの実装

例えば、よくある強撃系のスキルの `mpを5消費して、自分の攻撃力を1回だけ250%上げる` を実装してみます。なおスキルは自動発動にします。

```js
const hero = {
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30,
  def: 10,
  skill: { // skill追加
    attack: {
      name: '強撃',
      info: 'mpを5消費して、自分の攻撃力を1回だけ250%上げる',
      cost: 5 // 消費mp
    }
  }
}

const goblin = {
  maxHp: 300, // <- 少しタフに
  hp: 300,
  maxMp: 0,
  mp: 0,
  atk: 20,
  def: 5,
}

const damageCalculator = (offense, defense) => { ...略 }

const executeAttackPhase = (hero) => {
  if (hero.skill.attack) { // アタックスキルを持っていたら
    if (hero.mp >= hero.skill.attack.cost) { // mpが足りていれば
      hero.mp -= hero.skill.attack.cost // mpを消費して
      return hero.atk * 3.5 // スキル使用時の勇者の攻撃力を返す
    }
  }
  return hero.atk // 通常の勇者の攻撃力を返す
}

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtk = executeAttackPhase(hero) // アタックフェーズの実行
  const heroAtkDamage = damageCalculator(heroAtk, goblin.def)
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  if (goblin.hp > 0) {
    const goblinAtkDamage = damageCalculator(goblin.atk, hero.def)
    hero.hp -= goblinAtkDamage
    console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

```console
勇者のHP: 100  ゴブリンのHP: 300
勇者の攻撃、ゴブリンに100のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 90  ゴブリンのHP: 200
勇者の攻撃、ゴブリンに100のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 80  ゴブリンのHP: 100
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 70  ゴブリンのHP: 75
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 60  ゴブリンのHP: 50
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 50  ゴブリンのHP: 25
勇者の攻撃、ゴブリンに25のダメージ!
勇者の勝ち！
```

ちゃんと強撃スキルが2回発動して倒せました。強撃系スキルは純粋に強いので、上昇幅や使用可能回数の調整が大切になります。頑張って調整しましょう。

次々考えていきましょう。

## 大防御

`mpを1消費して、自分の防御力を1回だけ200%上げる` について考えてみます。先程と似ていますが、発動タイミングが違いますね。

```js
const hero = {
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30,
  def: 10,
  skill: {
    attack: {
      name: '強撃',
      info: 'mpを5消費して、自分の攻撃力を1回だけ250%上げる',
      cost: 5
    },
    defense: { // skill追加
      name: '大防御',
      info: 'mpを1消費して、自分の防御力を1回だけ200%上げる',
      cost: 1 // 消費mp
    }
  }
}

const goblin = { ...略 }

const damageCalculator = (offense, defense) => { ...略 }

const executeAttackPhase = (hero) => { ...略 }

const executeDefensePhase = (hero) => {
  if (hero.skill.defense) { // ディフェンススキルを持っていたら
    if (hero.mp >= hero.skill.defense.cost) { // mpが足りていれば
      hero.mp -= hero.skill.defense.cost // mpを消費して
      return hero.def * 2 // スキル使用時の勇者の防御力を返す
    }
  }
  return hero.def // 通常の勇者の防御力を返す
}

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtk = executeAttackPhase(hero)
  const heroAtkDamage = damageCalculator(heroAtk, goblin.def)
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  if (goblin.hp > 0) {
    const heroDefense = executeDefensePhase(hero) // ディフェンスフェーズの実行
    const goblinAtkDamage = damageCalculator(goblin.atk, heroDefense)
    hero.hp -= goblinAtkDamage
    console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

```console
勇者のHP: 100  ゴブリンのHP: 300
勇者の攻撃、ゴブリンに100のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 98  ゴブリンのHP: 200
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 96  ゴブリンのHP: 175
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 94  ゴブリンのHP: 150
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 92  ゴブリンのHP: 125
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 90  ゴブリンのHP: 100
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 80  ゴブリンのHP: 75
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 70  ゴブリンのHP: 50
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 60  ゴブリンのHP: 25
勇者の攻撃、ゴブリンに25のダメージ!
勇者の勝ち！
```

これで、敵からの攻撃時も大防御でダメージを軽減できました。アクティブスキルにすれば、敵の大技に合わせて繰り出すとユーザに「気持ちいい」を与えれますね。さぁ、どんどんいきましょう。

## ステータス強化

`戦闘開始時にパーティの攻撃力1.2倍` について考えてみます。ノーコストで、いるだけでバフ付与の、つよつよキャラですね。

```js
const hero = {
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30,
  def: 10,
  skill: {
    attack: {
      name: '強撃',
      info: 'mpを5消費して、自分の攻撃力を1回だけ250%上げる',
      cost: 5
    },
    defense: {
      name: '大防御',
      info: 'mpを1消費して、自分の防御力を1回だけ200%上げる',
      cost: 1
    },
    set: { // skill追加
      name: 'ステータス強化',
      info: '戦闘開始時にパーティの攻撃力1.2倍',
      cost: 0
    },
  }
}

const goblin = { ...略 }

const damageCalculator = (offense, defense) => { ...略 }

const executeAttackPhase = (hero) => { ...略 }

const executeDefensePhase = (hero) => { ...略 }

const executeSetPhase = (hero) => {
  if (hero.skill.set) { // セットスキルを持っていたら
    hero.atk = hero.atk * 1.2 // 攻撃力を1.2倍に
  }
}

executeSetPhase(hero) // セットフェーズの実行

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtk = executeAttackPhase(hero)
  const heroAtkDamage = damageCalculator(heroAtk, goblin.def)
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  if (goblin.hp > 0) {
    const heroDefense = executeDefensePhase(hero)
    const goblinAtkDamage = damageCalculator(goblin.atk, heroDefense)
    hero.hp -= goblinAtkDamage
    console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

```console
勇者のHP: 100  ゴブリンのHP: 300
勇者の攻撃、ゴブリンに121のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 98  ゴブリンのHP: 179
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 96  ゴブリンのHP: 148
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 94  ゴブリンのHP: 117
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 92  ゴブリンのHP: 86
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
-------------------
勇者のHP: 90  ゴブリンのHP: 55
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 80  ゴブリンのHP: 24
勇者の攻撃、ゴブリンに31のダメージ!
勇者の勝ち！
```

やっぱりステータス強化スキルは強いですね。ステータス強化と強撃の組み合わせはバランス崩壊に直結するので、気をつけましょう。さぁさぁどんどんいきましょう。

## 状態異常

`攻撃時に相手を毒にする` についても考えてみます。今回は確定で毒にできるとします。

```js
const hero = {
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30,
  def: 10,
  skill: {
    attack: {
      name: '強撃',
      info: 'mpを5消費して、自分の攻撃力を1回だけ250%上げる',
      cost: 5
    },
    defense: {
      name: '大防御',
      info: 'mpを1消費して、自分の防御力を1回だけ200%上げる',
      cost: 1
    },
    set: { // skill追加
      name: 'ステータス強化',
      info: '戦闘開始時にパーティの攻撃力1.2倍',
      cost: 0
    },
    attackAfter: {
      name: '毒撃',
      info: '攻撃時に相手を毒にする',
      cost: 0
    },
  }
}

const goblin = { ...略 }

const damageCalculator = (offense, defense) => { ...略 }

const executeAttackPhase = (hero) => { ...略 }

const executeDefensePhase = (hero) => { ...略 }

const executeSetPhase = (hero) => { ...略 }

const executeAttackAfterPhase = (hero) => {
  if (hero.skill.attackAfter) { // アタックアフタースキルを持っていたら
    goblin.status = 'poison' // 毒。毎ターンHPの1/10のダメージ
  }
}

executeSetPhase(hero)

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtk = executeAttackPhase(hero)
  const heroAtkDamage = damageCalculator(heroAtk, goblin.def)
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  executeAttackAfterPhase(hero) // アタックアフターフェーズの実行
  if (goblin.hp > 0) {
    const heroDefense = executeDefensePhase(hero)
    const goblinAtkDamage = damageCalculator(goblin.atk, heroDefense)
    hero.hp -= goblinAtkDamage
    console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    // 状態異常発生フェイズ
    if (goblin.status === 'poison') {
      const poisonDamage = Math.round(goblin.hp / 10)
      goblin.hp -= poisonDamage
      console.log(`ゴブリンに${poisonDamage}の毒ダメージ！`)
    }
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

```console
勇者のHP: 100  ゴブリンのHP: 300
勇者の攻撃、ゴブリンに121のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
ゴブリンに18の毒ダメージ！
-------------------
勇者のHP: 98  ゴブリンのHP: 161
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
ゴブリンに13の毒ダメージ！
-------------------
勇者のHP: 96  ゴブリンのHP: 117
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
ゴブリンに9の毒ダメージ！
-------------------
勇者のHP: 94  ゴブリンのHP: 77
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
ゴブリンに5の毒ダメージ！
-------------------
勇者のHP: 92  ゴブリンのHP: 41
勇者の攻撃、ゴブリンに31のダメージ!
ゴブリンの攻撃、勇者に2のダメージ
ゴブリンに1の毒ダメージ！
-------------------
勇者のHP: 90  ゴブリンのHP: 9
勇者の攻撃、ゴブリンに31のダメージ!
勇者の勝ち！
```

アタックアフターフェイズで毒を発生させました。確定で毒だと強すぎるので、実際には確率でにしたほうがいいと思います。勇者がつよつよになってきましたね！さぁまだまだ。

# 回避

次は `50%で攻撃を避ける` スキルを実装してみましょう。忍者や盗賊がよくもってるスキルですね。

```js
const hero = {
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30,
  def: 10,
  skill: {
    attack: {
      name: '強撃',
      info: 'mpを5消費して、自分の攻撃力を1回だけ250%上げる',
      cost: 5
    },
    defense: {
      name: '大防御',
      info: 'mpを1消費して、自分の防御力を1回だけ200%上げる',
      cost: 1
    },
    set: { // skill追加
      name: 'ステータス強化',
      info: '戦闘開始時にパーティの攻撃力1.2倍',
      cost: 0
    },
    attackAfter: {
      name: '毒撃',
      info: '攻撃時に相手を毒にする',
      cost: 0
    },
    defenseAfter: {
      name: '回避',
      info: '50%で攻撃を避ける',
      cost: 0
    }
  }
}

const goblin = { ...略 }

const damageCalculator = (offense, defense) => { ...略 }

const executeAttackPhase = (hero) => { ...略 }

const executeDefensePhase = (hero) => { ...略 }

const executeSetPhase = (hero) => { ...略 }

const executeAttackAfterPhase = (hero) => { ...略 }

const executeDefenseAfterPhase = (hero) => {
  if (hero.skill.defenseAfter) { // ディフェンスアフタースキルを持っていたら
    if (Math.random() > 0.5) {
      return true // 回避判定
    }
  }
  return false // 回避判定
}

executeSetPhase(hero)

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtk = executeAttackPhase(hero)
  const heroAtkDamage = damageCalculator(heroAtk, goblin.def)
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  executeAttackAfterPhase(hero)
  if (goblin.hp > 0) {
    const heroDefense = executeDefensePhase(hero)
    const goblinAtkDamage = damageCalculator(goblin.atk, heroDefense)
    const avoidanceFlg = executeDefenseAfterPhase(hero) // ディフェンスアフターフェーズの実行
    if (!avoidanceFlg) {
      hero.hp -= goblinAtkDamage
      console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    } else {
      console.log(`勇者はゴブリンの攻撃を回避した！`)
    }

    if (goblin.status === 'poison') {
      const poisonDamage = Math.round(goblin.hp / 10)
      goblin.hp -= poisonDamage
      console.log(`ゴブリンに${poisonDamage}の毒ダメージ！`)
    }
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

これで敵の攻撃を50%で避けることができるようになりました。更につよつよ勇者になってきましたね。次で最後にしましょう。

# スキル無効化スキル

`敵味方全員がスキル使用不可` というスキルを実装してみましょう。カタストロフ的なスキルですね。モンスターにスキルを設定してないから、デメリットしかありません。

```js
const hero = {
  maxHp: 100,
  hp: 100,
  maxMp: 10,
  mp: 10,
  atk: 30,
  def: 10,
  skill: {
    attack: {
      name: '強撃',
      info: 'mpを5消費して、自分の攻撃力を1回だけ250%上げる',
      cost: 5
    },
    defense: {
      name: '大防御',
      info: 'mpを1消費して、自分の防御力を1回だけ200%上げる',
      cost: 1
    },
    set: { // skill追加
      name: 'ステータス強化',
      info: '戦闘開始時にパーティの攻撃力1.2倍',
      cost: 0
    },
    attackAfter: {
      name: '毒撃',
      info: '攻撃時に相手を毒にする',
      cost: 0
    },
    defenseAfter: {
      name: '回避',
      info: '50%で攻撃を避ける',
      cost: 0
    },
    start: {
      name: 'スキル無効化',
      info: '敵味方全員がスキル使用不可',
      cost: 0
    },
  }
}

const goblin = { ...略 }

const damageCalculator = (offense, defense) => { ...略 }

const executeAttackPhase = (hero) => { ...略 }

const executeDefensePhase = (hero) => { ...略 }

const executeSetPhase = (hero) => { ...略 }

const executeAttackAfterPhase = (hero) => { ...略 }

const executeDefenseAfterPhase = (hero) => { ...略 }

const executeStartPhase = (hero) => {
  if (hero.skill.start) { // スタートスキルを持っていたら
    hero.skill = {}
    console.log('全員のスキルを無効化！')
  }
}

executeStartPhase(hero) // スタートフェーズの実行

executeSetPhase(hero)

while (hero.hp > 0 && goblin.hp > 0) {
  console.log(`勇者のHP: ${hero.hp}  ゴブリンのHP: ${goblin.hp}`)
  const heroAtk = executeAttackPhase(hero)
  const heroAtkDamage = damageCalculator(heroAtk, goblin.def)
  goblin.hp -= heroAtkDamage
  console.log(`勇者の攻撃、ゴブリンに${heroAtkDamage}のダメージ!`)
  executeAttackAfterPhase(hero)
  if (goblin.hp > 0) {
    const heroDefense = executeDefensePhase(hero)
    const goblinAtkDamage = damageCalculator(goblin.atk, heroDefense)
    const avoidanceFlg = executeDefenseAfterPhase(hero)
    if (!avoidanceFlg) {
      hero.hp -= goblinAtkDamage
      console.log(`ゴブリンの攻撃、勇者に${goblinAtkDamage}のダメージ`)
    } else {
      console.log(`勇者はゴブリンの攻撃を回避した！`)
    }

    if (goblin.status === 'poison') {
      const poisonDamage = Math.round(goblin.hp / 10)
      goblin.hp -= poisonDamage
      console.log(`ゴブリンに${poisonDamage}の毒ダメージ！`)
    }
    console.log('-------------------')
  }
}

if (hero.hp) {
  console.log('勇者の勝ち！')
} else {
  console.log('ゴブリンの勝ち！')
}
```

```console
全員のスキルを無効化！
勇者のHP: 100  ゴブリンのHP: 300
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 90  ゴブリンのHP: 275
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 80  ゴブリンのHP: 250
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 70  ゴブリンのHP: 225
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 60  ゴブリンのHP: 200
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 50  ゴブリンのHP: 175
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 40  ゴブリンのHP: 150
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 30  ゴブリンのHP: 125
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 20  ゴブリンのHP: 100
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
勇者のHP: 10  ゴブリンのHP: 75
勇者の攻撃、ゴブリンに25のダメージ!
ゴブリンの攻撃、勇者に10のダメージ
-------------------
ゴブリンの勝ち！
```

こういう時の為のスタートフェイズです。無事に勇者は全スキルが封印されて、非合法強化勇者はゴブリンに負けました。

めでたしめでたし。

# おわりに

普段何気なく遊んでいるゲームの「たたかう」ですが、こうやって自分でロジックを考えてソースコードに落としてみると、いろんな気付きがあるものです。面白そうだなぁと思ったら、ぜひやってみてください。ロジカルシンキングのトレーニングにもなります。
