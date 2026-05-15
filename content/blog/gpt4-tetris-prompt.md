---
title: "GPT-4 にテトリス風パズルゲームを作ってもらったプロンプト"
date: "2023-03-28"
description: "GPT-4 にテトリス風パズルゲームを作らせるために使ったプロンプトと生成結果を記録したメモ。"
tags: ["GPT", "HTML", "CSS", "JavaScript"]
draft: false
---

GPT 流行っていますね。この波に乗り遅れれば今後のエンジニア人生は暗いものになるかもしれません。

Twitter などで GPT を使って革新的なものを作っている方々を見て、私も自分で GPT を使ってプログラミングをしたいと思い、深津式プロンプト•システムやゴールシークプロンプトなどであれこれ試行錯誤していたのですが、今回ある程度満足の行くアウトプットができたので、その知見を共有します。

いろんな手法を試しましたが、結局は「懇切丁寧に GPT に頼む」というのが自分の中で最適解でした。

# 作ったもの

![tetris](/images/blog/gpt4-tetris-prompt-01.png)

[こちら](https://tlazol.github.io/tetris-built-with-gpt/) が今回 GPT に作ってもらったゲームです。[（ソースコード）](https://github.com/tlazol/tetris-built-with-gpt)。

自分はひとつもコードは書いていません。ぽちぽちと適切にコピペを繰り返した結果できあがったものになります。

完全に自動生成されたコードとしては十分なものだと思います。

# GPT とペアプログラミング

GPT は出だしが一番大切だと思っているので、色々なプロンプトを試してみましたが、下記のような会話の始まりだと、よい結果を得られる確率が高かったです。

以下 GPT と私の会話の抜粋です。

## 会話の出だし

### Me

```
あなたはプロのフロントエンドエンジニアです。
わたしもプロのフロントエンドエンジニアです。
これからペアプログラミングを行います。
私がナビゲーターであなたがドライバーです。
下記の仕様を元に最高のプログラムを作成しましょう。
準備ができたら OK と言ってください

仕様:
HTMLとCSSとJavaScriptで作る
作るものはテトリス
キーボードの矢印キーで操作する
テトリスのブロックはキラキラしていてカラフルな色のアニメーションもついている
スコア表示もついており、一度に消した行数を元に点数が加算されていく
```

### GPT

```
OK、準備ができました。
プロジェクトを始めましょう。

まず、HTMLファイルを作成し、
ゲームエリアとスコア表示のための基本的な構造を作りましょう。
```

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>テトリス</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div class="game-container">
      <div class="score">スコア: <span id="score">0</span></div>
      <canvas id="game-board" width="320" height="640"></canvas>
    </div>
    <script src="tetris.js"></script>
  </body>
</html>
```

```
次に、CSSファイル（styles.css）を作成して、
テトリスのゲームエリアとスコア表示のスタイルを設定しましょう。
```

```css
body {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f0f0;
  margin: 0;
  font-family: Arial, sans-serif;
}

.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #ffffff;
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.score {
  font-size: 1.5rem;
  margin-bottom: 10px;
}

canvas {
  border: 1px solid #000;
}
```

```
これで、HTMLとCSSの基本的な構造ができました。
次に、JavaScriptファイル（tetris.js）を作成して、
テトリスのロジックを実装しましょう。

まず、ゲームボードの描画やブロックの操作、スコアの計算など、
テトリスの基本的な機能を実装するために必要な変数や関数を定義しましょう。
また、キラキラしたカラフルなアニメーションを実装するために、
requestAnimationFrame関数を使用します。

詳細な実装は長くなるので、ここでは擬似コードを提供します。
```

```javascript
// 変数の定義（キャンバス、コンテキスト、ブロックサイズ、ゲームボード、現在のブロック、スコアなど）
// キラキラアニメーション用の変数も定義

// ブロックの形状や色を定義

// キーボードのイベントリスナーを設定（左右移動、回転、下に移動）

// 描画関数を定義
// キャンバスをクリア
// ゲ...
```

### Me

```
ありがとう。HTMLとCSSはこれで良いと思います。
Javascriptも長くなりますが一緒に実装しましょう。
私がナビゲーターであなたがドライバーです。
まずは最初の50行ぐらいを書いてみましょう。
```

### GPT

```
了解しました。最初の50行ほどのJavaScriptコードを書いてみます。
```

```javascript
// 変数の定義
const canvas = document.getElementById("game-board");
const ctx = canvas.getContext("2d");
const blockSize = 32;
const numRows = canvas.height / blockSize;
const numCols = canvas.width / blockSize;
let gameBoard = Array.from({ length: numRows }, () => Array(numCols).fill(0));
let currentBlock = null;
let score = 0;

// ブロックの形状と色を定義
const blocks = [
  // I
  {
    shape: [[1, 1, 1, 1]],
    color: "cyan",
  },
  // O
  {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "yellow",
  },
  // T
  {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "purple",
  },
  // S
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "green",
  },
  // Z
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "red",
  },
  // J
  {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "blue",
  },
  // L
  {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "orange",
  },
];

// ブロックを生成する関数
function createBlock() {
  const block = blocks[Math.floor(Math.random() * blocks.length)];
  return {
    x: Math.floor(numCols / 2) - Math.ceil(block.shape[0].length / 2),
    y: 0,
    shape: block.shape,
    color: block.color,
  };
}

currentBlock = createBlock();
```

```
ここまでで、変数の定義やブロックの形状と色の設定、
ブロックを生成する関数ができました。
次に、キーボードのイベントリスナーや
描画関数を実装していきましょう。
```

### Me

```
とても良いですね。
はい、では次の実装を50行ぐらいを書いてみましょう。
```

### GPT

```
承知しました。次の50行ほどの実装を書いてみます。
```

```javascript
// ブロックを描画する関数
function drawBlock(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
}

// ゲームボード全体を描画する関数
function drawGameBoard() {
  for (let y = 0; y < numRows; y++) {
    for (let x = 0; x < numCols; x++) {
      if (gameBoard[y][x]) {
        drawBlock(x, y, gameBoard[y][x]);
      }
    }
  }
}

// 現在のブロックを描画する関数
function drawCurrentBlock() {
  for (let y = 0; y < currentBlock.shape.length; y++) {
    for (let x = 0; x < currentBlock.shape[y].length; x++) {
      if (currentBlock.shape[y][x]) {
        drawBlock(currentBlock.x + x, currentBlock.y + y, currentBlock.color);
      }
    }
  }
}

// キーボードのイベントリスナーを設定
document.addEventListener("keydown", (event) => {
  const key = event.key;
  if (key === "ArrowLeft") {
    // 左に移動する処理
  } else if (key === "ArrowRight") {
    // 右に移動する処理
  } else if (key === "ArrowUp") {
    // 回転する処理
  } else if (key === "ArrowDown") {
    // 下に移動する処理
  }
});

// 描画関数
function draw() {
  // キャンバスをクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ゲームボード全体を描画
  drawGameBoard();

  // 現在のブロックを描画
  drawCurrentBlock();

  // 次のフレームへ
  requestAnimationFrame(draw);
}

// ゲームを開始
draw();
```

```
これで、ブロックとゲームボードの描画、
キーボードのイベントリスナー、描画関数の実装ができました。
次に、ブロックの移動や回転、行が揃った時の処理、
スコアの計算などの実装を進めていきましょう。
```

## エラーが起きた時の会話

### Me

```
上記コードを追記した結果
tetris.js:269 Uncaught ReferenceError: Cannot access 'particlesArray' before initialization
というエラーが発生しました。修正してみましょう。
```

### GPT

```
すみません、エラーが発生したようです。コードを修正してみます。
```

```javascript
// パーティクルの配列
const particlesArray = [];

// パーティクルクラス
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = Math.random() * 5 + 1;
    this.speedX = Math.random() * 3 - 1.5;
    this.speedY = Math.random() * 3 - 1.5;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.size -= 0.1;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
}
```

```
particlesArray の定義を
Particle クラスの定義よりも前に移動させました。
これでエラーが解決されるはずです。
再度、コード全体を修正した部分と合わせて実行してみてください。
```

## 仕様追加の時の会話

### Me

```
ではブロックを常に blink させる
アニメーションをつけることはできますか？
```

### GPT

```
はい、ブロックを常に点滅させるアニメーションを
追加することができます。
drawBlock関数を更新して、点滅効果を追加しましょう。
```

```javascript
// ブロックを描画する関数を更新
function drawBlock(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
  ctx.strokeStyle = "black";
  ctx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);

  // グラデーションの追加
  const gradient = ctx.createLinearGradient(
    x * blockSize,
    y * blockSize,
    (x + 1) * blockSize,
    (y + 1) * blockSize,
  );
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.fillRect(
    x * blockSize + 2,
    y * blockSize + 2,
    blockSize - 4,
    blockSize - 4,
  );

  // 点滅アニメーションの追加
  const blink = 0.5 + 0.5 * Math.sin(performance.now() / 300);
  ctx.fillStyle = `rgba(255, 255, 255, ${blink})`;
  ctx.fillRect(
    x * blockSize + 2,
    y * blockSize + 2,
    blockSize - 4,
    blockSize - 4,
  );
}
```

```
この変更により、ブロックは常に点滅するアニメーションが適用されます。
performance.now()を使って現在のアニメーション時間を取得し、
Math.sin関数を使用して点滅のオーバーレイの透明度を調整しています。
ブロックの点滅速度を変更したい場合は、
performance.now()の引数を調整してください。
```

## 実装不備が起きた時の会話

### Me

```
実行してみましたが、
ブロックが一番上まで積まれてもゲームオーバーにならないようです
```

### GPT

```
すみません、ゲームオーバーの検出に問題があるようです。
detectGameOver関数を以下のように修正してみましょう。
```

```javascript
// ゲームオーバーを検出する関数
function detectGameOver() {
  for (let x = 0; x < numCols; x++) {
    if (gameBoard[0][x] !== 0) {
      return true;
    }
  }
  return false;
}
```

```
この修正により、ブロックが一番上まで積まれたら
ゲームオーバーになるはずです。
detectGameOver関数は、
ゲームボードの一番上の行をチェックし、
もしブロックが存在すれば、
ゲームオーバーと判定します。
```

## デザイン修正の時の会話

### Me

```
全体的にダークテーマのcssに修正してください
```

### GPT

```
全体をダークテーマに変更するために、
![tetris](/images/blog/gpt4-tetris-prompt-01.png)以下のCSSとHTMLの変更を行います。

index.htmlにダークテーマの背景色とテキスト色を設定します。
```

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="styles.css" />
    <title>Tetris</title>
  </head>
  <body>
    <div class="container">
      <h1>Tetris</h1>
      <canvas id="gameCanvas" width="320" height="640"></canvas>
      <div class="score">
        <h2>Score</h2>
        <p id="score">0</p>
      </div>
    </div>
    <script src="tetris.js"></script>
  </body>
</html>
```

```
styles.cssを以下のように更新して、
ダークテーマのスタイルを適用します。
```

```css
body {
  background-color: #222;
  color: #f0f0f0;
  font-family: Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

h1 {
  font-size: 48px;
  margin-bottom: 10px;
}

canvas {
  border: 1px solid #f0f0f0;
}

.score {
  margin-top: 20px;
}

h2 {
  font-size: 24px;
  margin-bottom: 5px;
}
```

```
この変更により、背景色がダークグレーになり、
テキスト色が明るいグレーになります。
また、キャンバスの周囲に明るいグレーの境界線が表示されます。
これで全体がダークテーマになります。
必要に応じて、さらに色やスタイルを調整してカスタマイズできます。
```

# 作ってもらった感想

まず、今回これはいいなと思えたのは「まずは50行ぐらい書いてみて」という指示でした。
今までは GPT の返信が長すぎて、途中でよくソースコードが途切れてしまい「続きを書いて」と言っても前後が繋がらない場合が多々あったからです。
この指示の方法であれば、途中で切れる事もなく、また前後がちゃんと繋がるようにソースコードをアウトプットしてくれました。

自分で書けば1時間で終わるタスクを、数時間かけて GPT に作ってもらったという感覚もありますが、ある程度の知識があれば誰でも同様のものをアウトプットできるようになるという事実には驚愕します。特に「プログラミングをしてみたかった」というコンプレックスを持っている人たちにとってはとても素晴らしいツールになるのではないでしょうか。

今は正直 GPT を介護しながらプログラミングをしている感が強いですが、こんなのはすぐに進化して「GPT が書いたソースコードに間違いがあるはずがない」という時代は確実に来ると信じています。

いまのうちに GPT を使いこなすすべを身につけようと、あらためて感じました。
