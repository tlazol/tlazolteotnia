---
title: "ローカライズしてみて得た文章構成の知見をソースコードで見る"
date: "2020-12-29"
description: "ローカライズ対応を通じて得た、英語と日本語で伝わりやすい文章構成の違いをコード例で整理した記事。"
tags: ["ローカライズ", "JavaScript", "英語"]
draft: false
---
自分がリリースしているアプリのうち、半分を英語にローカライズしてリリースしています。その時行った、英語と日本語の差を埋めるソースコードをいくつか共有しようと思います。

処理自体は簡単なものですが、英語アプリ作成の知見がほぼ0の自分にとっては新鮮なロジックでした。

# 時間（分）の文章の差

### 日本語

```js
const min = 1

// OK: 彼はあと 1 分で帰ってくると思います。
console.log(`彼はあと ${min} 分で帰ってくると思います。`)
```

```js
const min = 5

// OK: 彼はあと 5 分で帰ってくると思います。
console.log(`彼はあと ${min} 分で帰ってくると思います。`)
```

### 英語

```js
const min = 1

// OK: I think he'll be back in 1 minute.
console.log(`I think he'll be back in ${min} minute.`)
```

```js
const min = 5

// NG: I think he'll be back in 5 minute.
console.log(`I think he'll be back in ${min} minute.`)
```

「あと*分で帰ってきます。」というような文章を構築する場合、日本語なら上記で問題ありませんが、英語の場合はちょっと違います。1分の場合以外は minute を複数形にする必要があります。

```js
cost getMinutesText = (min) => {
  if (Number(min) === 1) {
    return `${min} minute`
  }
  return `${min} minutes`
}

const min = 5
const minutesText = getMinutesText(min)

// OK: I think he'll be back in 5 minutes.
console.log(`I think he'll be back in ${minutesText}.`)
```

例えばこのようにすればいいでしょう。

# ◯ と △ と □ の文章の差

### 日本語

```js
const arr = ['◯', '△', '□']

// OK: ◯と△と□が足りないです
console.log(`${arr.join('と')}が足りないです。`)
```

### 英語
```js
const arr = ['◯', '△', '□']

// NG: You are short ◯, △, □.
console.log(`You are short ${arr.join(', ')}.`)
```

「◯と△と□が足りないです」というような文章を構築する場合も、英語だと少し手を加える必要があります。英語の場合「◯, △, □」ではなく「◯, △, and □」であるべきだからです。

```js
const arr = ['◯', '△', '□']

// OK: You are short ◯, △, and □.
if (arr.length > 1) {
  console.log(`You are short ${arr.slice(0, -1).join(', ')}, and ${arr.slice(-1)}.`)
} else {
  console.log(`You are short ${arr.join(', ')}.`)
}
```

例えばこのようにすればいいでしょう。

# 先頭を大文字に

これも日本語にはない表現ですが、英語でこれを無視すると、ちょっと間が抜けて見えます。

```js
const uppercaseFirstLetter = (text) => {
  return `${text.substring(0, 1).toUpperCase() + text.substring(1)}`
}

// OK: Hogehogehoge
uppercaseFirstLetter('hogehogehoge')
```

例えばこのようにすればいいでしょう。

# 命数法の違い

命数法も日本語と英語で違いますので、巨大な数字を表現したい場合、それぞれ別のロジックを組むとよいでしょう。

### 日本語

```js
const number = '123456789123456789123456789123456789123456789123456789123456789'
const numberLength = number.length
let n

if (numberLength < 9) {
  n = `${Math.round(Number(number.slice(0, -3))) / 10}万`
} else if (numberLength < 13) {
  n = `${Math.round(Number(number.slice(0, -7))) / 10}億`
} else if (numberLength < 17) {
  n = `${Math.round(Number(number.slice(0, -11))) / 10}兆`
} else if (numberLength < 21) {
  n = `${Math.round(Number(number.slice(0, -15))) / 10}京`
} else if (numberLength < 25) {
  n = `${Math.round(Number(number.slice(0, -19))) / 10}垓`
} else if (numberLength < 29) {
  n = `${Math.round(Number(number.slice(0, -23))) / 10}𥝱`
} else if (numberLength < 33) {
  n = `${Math.round(Number(number.slice(0, -27))) / 10}穣`
} else if (numberLength < 37) {
  n = `${Math.round(Number(number.slice(0, -31))) / 10}溝`
} else if (numberLength < 41) {
  n = `${Math.round(Number(number.slice(0, -35))) / 10}澗`
} else if (numberLength < 45) {
  n = `${Math.round(Number(number.slice(0, -39))) / 10}正`
} else if (numberLength < 49) {
  n = `${Math.round(Number(number.slice(0, -43))) / 10}載`
} else if (numberLength < 53) {
  n = `${Math.round(Number(number.slice(0, -47))) / 10}極`
} else if (numberLength < 57) {
  n = `${Math.round(Number(number.slice(0, -51))) / 10}恒河沙`
} else if (numberLength < 61) {
  n = `${Math.round(Number(number.slice(0, -55))) / 10}阿僧祇`
} else if (numberLength < 65) {
  n = `${Math.round(Number(number.slice(0, -59))) / 10}那由他`
} else if (numberLength < 69) {
  n = `${Math.round(Number(number.slice(0, -63))) / 10}不可思議`
} else {
  n = `${Math.round(Number(number.slice(0, -67))) / 10}無量大数`
}

// OK: 123.4那由他
console.log(n)
```

### 英語

```js
const number = '123456789123456789123'
const numberLength = number.length
let n

if (numberLength < 10) {
  n = `${Math.round(Number(number.slice(0, -5))) / 10} million`
} else if (numberLength < 13) {
  n = `${Math.round(Number(number.slice(0, -8))) / 10} billion`
} else if (numberLength < 16) {
  n = `${Math.round(Number(number.slice(0, -11))) / 10} trillion`
} else if (numberLength < 19) {
  n = `${Math.round(Number(number.slice(0, -14))) / 10} quadrillion`
} else if (numberLength < 22) {
  n = `${Math.round(Number(number.slice(0, -17))) / 10} quintillion`
} else if (numberLength < 25) {
  n = `${Math.round(Number(number.slice(0, -20))) / 10} sextillion`
} else {
  n = `${Math.round(Number(number.slice(0, -23))) / 10} septillion`
}

// OK: 123.4 quintillion
console.log(n)
```

ただし JavaScript は大きな数字を扱うのが苦手という事と、英語の命数法が少ないという事がありますので、日本語でいう「那由多」や「不可思議」までの単位の数値を扱いたい場合は違う表現を考えたほうがいいと思います。

# おわりに

ローカライズしてみて日本語と英語の差って面白いなぁと思いつつロジックを組んだ思い出があります。またこういう表現の差とは別に何気なく英語を書いてみたら実は隠語を含んでいて別の意味にも捉えられていた事もあります。もしローカライズされる時はそこらへんも意識するといいかもしれません…（2敗）
