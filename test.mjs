import readline from "node:readline";

// ゲーム画面のサイズ
const WIDTH = 30;
const HEIGHT = 15;

// 1フレームの間隔。
// 100msなので、1秒間に10回更新されます。
const FRAME_INTERVAL = 100;

// プレイヤーの初期位置
const player = {
  x: Math.floor(WIDTH / 2),
  y: HEIGHT - 1,
};

// 上から落ちてくる障害物
let obstacles = [];

// ゲームの状態
let score = 0;
let frameCount = 0;
let running = true;
let gameTimer;

/**
 * ターミナルが対話型か確認します。
 *
 * ファイルへのリダイレクトなどではrawモードを利用できないため、
 * 通常のターミナルから起動されている必要があります。
 */
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("このゲームは対話型ターミナルで実行してください。");
  process.exit(1);
}

// stdinからkeypressイベントを発生させます。
readline.emitKeypressEvents(process.stdin);

// Enterを待たず、一文字ずつ入力を受け取るモードにします。
process.stdin.setRawMode(true);
process.stdin.resume();

/**
 * キー入力を処理します。
 */
process.stdin.on("keypress", (_text, key) => {
  // Ctrl+Cまたはqで終了
  if ((key.ctrl && key.name === "c") || key.name === "q") {
    finishGame("ゲームを終了しました。");
    return;
  }

  // 左矢印キーまたはAキー
  if (key.name === "left" || key.name === "a") {
    player.x = Math.max(0, player.x - 1);
  }

  // 右矢印キーまたはDキー
  if (key.name === "right" || key.name === "d") {
    player.x = Math.min(WIDTH - 1, player.x + 1);
  }
});

/**
 * 障害物を生成します。
 */
function createObstacle() {
  obstacles.push({
    x: Math.floor(Math.random() * WIDTH),
    y: 0,
  });
}

/**
 * ゲーム状態を1フレーム進めます。
 */
function updateGame() {
  frameCount += 1;

  // 5フレームごとに障害物を追加します。
  if (frameCount % 5 === 0) {
    createObstacle();
  }

  // 障害物を1マス下へ移動します。
  for (const obstacle of obstacles) {
    obstacle.y += 1;
  }

  // 画面外に出た障害物を削除します。
  obstacles = obstacles.filter((obstacle) => obstacle.y < HEIGHT);

  // プレイヤーと障害物の衝突を判定します。
  const collided = obstacles.some(
    (obstacle) =>
      obstacle.x === player.x &&
      obstacle.y === player.y,
  );

  if (collided) {
    finishGame("障害物にぶつかりました！");
    return;
  }

  score += 1;
}

/**
 * 現在のゲーム状態をターミナルへ描画します。
 */
function renderGame() {
  // HEIGHT行、WIDTH列の空の画面を作ります。
  const screen = Array.from(
    { length: HEIGHT },
    () => Array(WIDTH).fill(" "),
  );

  // 障害物を配置します。
  for (const obstacle of obstacles) {
    if (
      obstacle.x >= 0 &&
      obstacle.x < WIDTH &&
      obstacle.y >= 0 &&
      obstacle.y < HEIGHT
    ) {
      screen[obstacle.y][obstacle.x] = "X";
    }
  }

  // プレイヤーを配置します。
  screen[player.y][player.x] = "A";

  const horizontalBorder = `+${"-".repeat(WIDTH)}+`;

  const rows = screen.map(
    (row) => `|${row.join("")}|`,
  );

  const output = [
    horizontalBorder,
    ...rows,
    horizontalBorder,
    `SCORE: ${score}`,
    "← → または A D で移動 / Q で終了",
  ].join("\n");

  // カーソルを左上へ戻し、同じ場所に画面を描き直します。
  process.stdout.write(`\x1b[H${output}`);
}

/**
 * ターミナルの設定を元に戻します。
 */
function restoreTerminal() {
  if (process.stdin.isTTY && process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }

  // 非表示にしていたカーソルを再表示します。
  process.stdout.write("\x1b[?25h");
}

/**
 * ゲームを終了します。
 */
function finishGame(message) {
  if (!running) {
    return;
  }

  running = false;
  clearInterval(gameTimer);
  restoreTerminal();

  process.stdout.write(
    `\n\n${message}\n最終スコア: ${score}\n`,
  );

  process.exit(0);
}

/**
 * ゲームを開始します。
 */
function startGame() {
  // 画面を消去します。
  process.stdout.write("\x1b[2J");

  // カーソルを左上へ移動します。
  process.stdout.write("\x1b[H");

  // 描画中のカーソル点滅を防ぐため、カーソルを隠します。
  process.stdout.write("\x1b[?25l");

  renderGame();

  gameTimer = setInterval(() => {
    if (!running) {
      return;
    }

    updateGame();

    if (running) {
      renderGame();
    }
  }, FRAME_INTERVAL);
}

// 予期しない終了時にも、可能な範囲でターミナルを元に戻します。
process.on("exit", restoreTerminal);

startGame();
