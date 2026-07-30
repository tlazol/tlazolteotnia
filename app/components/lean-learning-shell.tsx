import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { type LeanCodeLanguage, PrismCode } from '~/components/lean-syntax-highlight'
import {
  getLeanLessonNeighbors,
  type LeanLesson,
  leanLessonHref,
  leanLessons
} from '~/lib/lean-learning'
import '~/lean-learning.css'

type LeanLearningShellProps = {
  children: ReactNode
  currentLesson?: LeanLesson
}

export function LeanLearningShell({ children, currentLesson }: LeanLearningShellProps) {
  return (
    <div className="lean-app" lang="ja">
      <header className="lean-header">
        <Link className="lean-brand" to="/app/lean-learning" aria-label="Lean入門のホーム">
          <span className="lean-brand__mark" aria-hidden="true">
            ⊢
          </span>
          <span>
            <strong>Lean 入門</strong>
            <small>証明をコードとして読む</small>
          </span>
        </Link>

        <nav className="lean-header__nav" aria-label="教材ナビゲーション">
          <Link to="/app/lean-learning">レッスン一覧</Link>
          <a href="https://lean-lang.org/doc/reference/latest/">
            公式リファレンス
            <span aria-hidden="true">↗</span>
          </a>
          <Link to="/">サイトへ戻る</Link>
        </nav>
      </header>

      {currentLesson && <LessonRail currentLesson={currentLesson} />}

      <main className={currentLesson ? 'lean-main lean-main--lesson' : 'lean-main'}>
        {children}
      </main>

      <footer className="lean-footer">
        <span>Leanを知らない状態から、保証の境界まで。</span>
        <a href="https://lean-lang.org/doc/reference/latest/ValidatingProofs/">
          証明の検証について
          <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  )
}

function LessonRail({ currentLesson }: { currentLesson: LeanLesson }) {
  return (
    <nav className="lesson-rail" aria-label="レッスン">
      <ol>
        {leanLessons.map((lesson) => {
          const isCurrent = lesson.slug === currentLesson.slug
          const isPast = lesson.number < currentLesson.number

          return (
            <li key={lesson.slug}>
              <Link
                className={isCurrent ? 'is-current' : isPast ? 'is-past' : undefined}
                to={leanLessonHref(lesson.slug)}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <span className="lesson-rail__number">
                  {isPast ? (
                    <span role="img" aria-label="完了">
                      ✓
                    </span>
                  ) : (
                    lesson.number
                  )}
                </span>
                <span className="lesson-rail__title">{lesson.shortTitle}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function LessonHeader({ lesson }: { lesson: LeanLesson }) {
  return (
    <header className="lesson-header">
      <p className="lean-eyebrow">Lesson {String(lesson.number).padStart(2, '0')}</p>
      <h1>{lesson.title}</h1>
      <p className="lesson-header__summary">{lesson.summary}</p>
      <div className="lesson-outcome">
        <span>このレッスンの到達点</span>
        <p>{lesson.outcome}</p>
      </div>
    </header>
  )
}

export function LessonPager({ lesson }: { lesson: LeanLesson }) {
  const { previous, next } = getLeanLessonNeighbors(lesson.slug)

  return (
    <nav className="lesson-pager" aria-label="前後のレッスン">
      {previous ? (
        <Link className="lesson-pager__previous" to={leanLessonHref(previous.slug)}>
          <span>← 前のレッスン</span>
          <strong>{previous.shortTitle}</strong>
        </Link>
      ) : (
        <Link className="lesson-pager__previous" to="/app/lean-learning">
          <span>← 教材ホーム</span>
          <strong>レッスン一覧</strong>
        </Link>
      )}
      {next ? (
        <Link className="lesson-pager__next" to={leanLessonHref(next.slug)}>
          <span>次のレッスン →</span>
          <strong>{next.shortTitle}</strong>
        </Link>
      ) : (
        <Link className="lesson-pager__next" to="/app/lean-learning">
          <span>教材ホームへ →</span>
          <strong>もう一度振り返る</strong>
        </Link>
      )}
    </nav>
  )
}

export function LessonSection({
  label,
  title,
  children
}: {
  label: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="lesson-section">
      <div className="lesson-section__heading">
        <span>{label}</span>
        <h2>{title}</h2>
      </div>
      <div className="lesson-section__body">{children}</div>
    </section>
  )
}

export type CodeGuideItem = {
  token: string
  explanation: string
}

function detectCodeLanguage(label: string): LeanCodeLanguage {
  if (label.endsWith('.ts')) return 'typescript'
  if (label.endsWith('.toml')) return 'toml'
  if (label === 'terminal' || label === 'build' || label === 'CIの責務') return 'bash'
  return 'lean'
}

function findToken(source: string, token: string) {
  return source.indexOf(token)
}

function addGuideItem(
  items: (CodeGuideItem & { position: number })[],
  seen: Set<string>,
  token: string,
  explanation: string,
  position: number
) {
  if (position < 0 || seen.has(token)) return

  seen.add(token)
  items.push({ token, explanation, position })
}

function buildLeanGuide(source: string): CodeGuideItem[] {
  const items: (CodeGuideItem & { position: number })[] = []
  const seen = new Set<string>()

  for (const match of source.matchAll(
    /\b(def|theorem|structure|inductive)\s+([\p{L}_][\p{L}\p{N}_₀-₉]*)/gu
  )) {
    const keyword = match[1] as 'def' | 'theorem' | 'structure' | 'inductive'
    const name = match[2]
    const namePosition = (match.index ?? 0) + match[0].lastIndexOf(name)
    const descriptions = {
      def: `「${name}」という計算できる定義を始めるキーワードです。`,
      theorem: `「${name}」という名前で定理を宣言するキーワードです。`,
      structure: `「${name}」という、複数のフィールドを持つ型を宣言するキーワードです。`,
      inductive: `「${name}」という、値の作り方を列挙する帰納型を宣言するキーワードです。`
    } as const

    addGuideItem(items, seen, keyword, descriptions[keyword], match.index ?? 0)
    addGuideItem(
      items,
      seen,
      name,
      `${keyword}で付けた宣言名です。後続のコードからは「${name}」で参照します。`,
      namePosition
    )
  }

  for (const match of source.matchAll(/\(([\p{L}_][\p{L}\p{N}_₀-₉]*)\s*:\s*([^)]+)\)/gu)) {
    const name = match[1]
    const type = match[2].trim()

    addGuideItem(
      items,
      seen,
      match[0],
      `「${name}」という入力を宣言し、その型が「${type}」であることを示します。`,
      match.index ?? 0
    )
  }

  const syntax: readonly [string, string][] = [
    ['example', '名前を環境へ残さず、式や証明が型検査を通るか試すための宣言です。'],
    ['#check', '後ろに書いた式を実行せず、Leanが推論した型を表示するコマンドです。'],
    ['#eval', '後ろの式を計算し、その結果を表示するコマンドです。'],
    ['#print axioms', '定理が最終的に依存している公理を表示するコマンドです。'],
    ['#print', '登録済みの定義や定理の内容を表示するコマンドです。'],
    ['#synth', '指定した型クラスのインスタンスをLeanに探索させるコマンドです。'],
    ['Nat', '0以上の整数を表す自然数型です。'],
    ['Bool', 'trueまたはfalseを値に持つ真偽値型です。'],
    ['String', '文字列を表す型です。'],
    ['Type', '値の型を分類する、型のための型です。'],
    ['Prop', '証明できる命題を分類する型です。'],
    [':=', '左側で宣言した名前や型に、右側の定義本体または証明を与える記号です。'],
    [':', '名前や式の後ろに、その型または証明したい命題を続ける区切りです。'],
    ['→', '左側の型を入力として受け取り、右側の型を返す関数型を表します。'],
    ['=>', '左側の引数やパターンに対する処理を、右側に続ける記号です。'],
    ['+', '左右の値を足し合わせる演算子です。この例では自然数の加算になります。'],
    ['fun', '名前を付けずに関数を作るキーワードです。'],
    ['by', 'ここからタクティクを使って証明を組み立てることを示します。'],
    ['rfl', '両辺を計算・展開すると同じになる等式を証明するタクティクです。'],
    ['intro', '関数型や含意の入力を仮定として受け取り、ゴールを一段進めるタクティクです。'],
    ['exact', '現在のゴールと同じ型を持つ証明項を、そのまま渡すタクティクです。'],
    ['apply', '関数や含意を逆向きに使い、必要な入力を新しいゴールにするタクティクです。'],
    ['constructor', '連言や構造体などを、その構成要素ごとのゴールに分けるタクティクです。'],
    ['cases', '帰納型の値がどのコンストラクタで作られたかに応じて場合分けします。'],
    ['induction', '再帰的な値を場合分けし、再帰部分に帰納法の仮定を用意します。'],
    ['simp only', '角括弧内に明示した規則だけを使って式やゴールを簡約します。'],
    ['simp', '登録済みの規則を使い、式やゴールを単純な形へ簡約します。'],
    ['where', '構造体や帰納型のフィールド、コンストラクタをここから列挙します。'],
    ['deriving', '表示や比較などの実装を、宣言した型から自動生成します。'],
    ['|', 'パターンマッチやコンストラクタの各選択肢を始める記号です。'],
    ['∀', '任意の値すべてについて命題が成り立つ、全称量化を表します。'],
    ['∃', '条件を満たす値が少なくとも一つある、存在量化を表します。'],
    ['--', 'この記号から行末までは、Leanが実行しないコメントです。']
  ]

  for (const [token, explanation] of syntax) {
    addGuideItem(items, seen, token, explanation, findToken(source, token))
  }

  return items
    .sort((left, right) => left.position - right.position)
    .map(({ token, explanation }) => ({ token, explanation }))
}

function buildTypeScriptGuide(source: string): CodeGuideItem[] {
  const syntax: readonly [string, string][] = [
    ['import', '別モジュールが公開している機能を、このファイルへ読み込みます。'],
    ['type', 'TypeScript上で扱う値の形に名前を付けます。実行時の検査は行いません。'],
    ['unknown', 'まだ安全に利用できると確認していない、未知の値を表す型です。'],
    ['function', '名前付きの関数を宣言するキーワードです。'],
    ['value is Verdict', 'trueを返した後はvalueをVerdictとして扱える、型述語です。'],
    ['async', 'Promiseを返す非同期関数を宣言するキーワードです。'],
    ['await', 'Promiseの完了を待ち、成功した値を取り出します。'],
    ['JSON.parse', 'JSON文字列をJavaScriptの値へ変換します。結果の形は別途検査が必要です。'],
    ['throw new Error', '境界で期待した値でなければ、処理を例外として中断します。']
  ]

  return syntax
    .map(([token, explanation]) => ({
      token,
      explanation,
      position: findToken(source, token)
    }))
    .filter((item) => item.position >= 0)
    .sort((left, right) => left.position - right.position)
    .map(({ token, explanation }) => ({ token, explanation }))
}

function buildTomlGuide(source: string): CodeGuideItem[] {
  const syntax: readonly [string, string][] = [
    ['name', 'パッケージや実行可能ターゲットの名前を設定します。'],
    ['version', 'このパッケージのバージョンを設定します。'],
    ['defaultTargets', '`lake build`で標準的にビルドする対象を指定します。'],
    ['[[lean_exe]]', 'Leanの実行可能ファイルを作る設定ブロックを始めます。'],
    ['root', '実行可能ファイルの入口になるLeanモジュールを指定します。']
  ]

  return syntax
    .map(([token, explanation]) => ({
      token,
      explanation,
      position: findToken(source, token)
    }))
    .filter((item) => item.position >= 0)
    .sort((left, right) => left.position - right.position)
    .map(({ token, explanation }) => ({ token, explanation }))
}

function buildShellGuide(source: string): CodeGuideItem[] {
  return source
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('--'))
    .map((line) => {
      const command = line.trim()
      const explanations: Record<string, string> = {
        'lake build': 'Leanプロジェクトをビルドし、定義・命題・証明を型検査します。',
        'npm run typecheck': 'TypeScriptの型検査を実行します。',
        'npm test': 'プロジェクトの自動テストを実行します。',
        'cd lean-policy': '以降のコマンドを実行する場所をLeanプロジェクトへ移します。'
      }

      return {
        token: command,
        explanation:
          explanations[command] ??
          (command.startsWith('./')
            ? 'ビルドした実行可能ファイルを、後ろの値を引数にして実行します。'
            : 'シェルでこのコマンドを実行します。')
      }
    })
}

export function buildCodeGuide(source: string, language: LeanCodeLanguage = 'lean') {
  let guide: CodeGuideItem[]

  switch (language) {
    case 'typescript':
      guide = buildTypeScriptGuide(source)
      break
    case 'toml':
      guide = buildTomlGuide(source)
      break
    case 'bash':
      guide = buildShellGuide(source)
      break
    case 'lean':
      guide = buildLeanGuide(source)
      break
  }

  return guide.length > 0
    ? guide
    : [
        {
          token: 'コード全体',
          explanation: 'このコードが何を入力し、何を返すかを、前後の本文と合わせて読みます。'
        }
      ]
}

function explainLeanLine(line: string) {
  if (line.startsWith('--')) {
    return 'Leanが実行しない注釈で、この例の意図や出力を示します。'
  }
  if (line.startsWith('import ')) {
    return '後続のコードで使う定義を、このモジュールから読み込みます。'
  }
  if (line.startsWith('universe ')) {
    return '任意の型階層を扱うための宇宙変数を宣言します。'
  }

  const declaration = line.match(
    /^(def|theorem|structure|inductive)\s+([\p{L}_][\p{L}\p{N}_₀-₉]*)/u
  )
  if (declaration) {
    const [, keyword, name] = declaration
    const actions: Record<string, string> = {
      def: `計算できる定義「${name}」の型と本体を書き始めます。`,
      theorem: `証明する定理「${name}」の命題を書き始めます。`,
      structure: `複数のフィールドを持つ型「${name}」を宣言します。`,
      inductive: `コンストラクタで値を作る帰納型「${name}」を宣言します。`
    }

    return actions[keyword]
  }
  if (line.startsWith('example')) {
    return '名前を残さず、この命題または式が型検査を通るか確認します。'
  }
  if (line.startsWith('#check')) {
    return '式を実行せず、Leanが推論した型を表示します。'
  }
  if (line.startsWith('#eval')) {
    return '式を評価し、計算結果を表示します。'
  }
  if (line.startsWith('#print axioms')) {
    return '定理が最終的に依存している公理を一覧表示します。'
  }
  if (line.startsWith('#print')) {
    return '登録済みの宣言を、Leanが保持する形で表示します。'
  }
  if (line.startsWith('#synth')) {
    return '必要な型クラスのインスタンスをLeanに探索させます。'
  }
  if (line.startsWith('|')) {
    if (line.endsWith('=>')) {
      return 'このパターンに一致する分岐を始め、処理を次の行へ続けます。'
    }

    return line.includes('=>')
      ? 'このパターンに一致した入力の結果を、右辺で定義します。'
      : 'この帰納型の値を作るコンストラクタを追加します。'
  }
  if (line.startsWith('deriving ')) {
    return '宣言した型から、指定した機能の実装を自動生成します。'
  }
  if (line.startsWith('intro ')) {
    return '含意の前提を仮定として受け取り、残りを新しいゴールにします。'
  }
  if (line.startsWith('exact ')) {
    return '現在のゴールと同じ型を持つ証明項を、そのまま渡します。'
  }
  if (line.startsWith('apply ')) {
    return '結論がゴールに合う定理を使い、必要な前提を新しいゴールにします。'
  }
  if (line === 'constructor') {
    return '連言などのゴールを、構成要素ごとのサブゴールに分けます。'
  }
  if (line.startsWith('cases ')) {
    return '値をコンストラクタごとの場合に分けて調べます。'
  }
  if (line.startsWith('induction ')) {
    return '再帰的な値を場合分けし、再帰部分に帰納法の仮定を用意します。'
  }
  if (line.startsWith('simp only')) {
    return '列挙した規則だけを使い、ゴールを簡約します。'
  }
  if (line.startsWith('simp')) {
    return '定義や既知の補題を使い、ゴールを単純な形へ変えます。'
  }
  if (line === 'rfl' || line.endsWith('=> rfl')) {
    return '両辺を計算すると同じ形になることを使い、等式を閉じます。'
  }
  if (line.startsWith('refine ')) {
    return '証明項の分かっている部分を与え、未確定部分を新しいゴールにします。'
  }
  if (line === 'decide') {
    return '判定可能な命題を計算し、その結果から証明を作ります。'
  }
  if (line === 'sorry') {
    return '未完成の証明を公理で仮置きします。本番の証明には残せません。'
  }
  if (line.startsWith('fun ')) {
    return '入力から証明または値を返す無名関数を構成します。'
  }
  if (line.startsWith('if ')) {
    return '条件を判定し、成立する場合の値を次の行で返します。'
  }
  if (line === 'else') {
    return '直前の条件が成立しない場合の処理へ分岐します。'
  }
  if (line.startsWith('let ')) {
    return '後続の処理で使う局所的な名前へ、計算結果を束縛します。'
  }
  if (line.startsWith('IO.println')) {
    return '計算結果をJSON文字列に変換し、標準出力へ書き出します。'
  }
  if (line === 'n + n') {
    return '入力nを自身に足し、2倍した自然数を定義の結果にします。'
  }
  if (line === 'f (f n)') {
    return '関数fを入力nへ2回適用し、その結果を返します。'
  }
  if (line === 'reprStr value') {
    return '型クラスから得た表示機能を使い、値を文字列へ変換します。'
  }
  if (line === 'Vector.replicate n value') {
    return 'valueをn個並べ、長さnが型に記録されたVectorを作ります。'
  }
  if (line === 'h hp') {
    return '含意の証明hへpの証明hpを渡し、ゴールqの証明を得ます。'
  }
  if (line === 'hasValidKey') {
    return '入力された鍵の有効性を、そのまま判定結果として返します。'
  }
  if (line === 'true') {
    return '入力に関係なく常にtrueを返す、意図的に壊した実装です。'
  }
  if (line === '_') {
    return 'まだ入力していないタクティクの位置をプレースホルダーで示します。'
  }
  if (line.startsWith('{')) {
    return '構造体の各フィールドへ値を入れ、新しい値を組み立てます。'
  }
  if (line.startsWith('·')) {
    return '分割された現在のサブゴールに対する証明を書きます。'
  }
  if (line.startsWith('(')) {
    return '前の宣言に必要な引数または仮定を追加します。'
  }
  if (/^[\p{L}_][\p{L}\p{N}_.?₀-₉]*\s*:/u.test(line)) {
    return 'この名前が保持する値の型を指定します。'
  }
  if (line.includes(':= by')) {
    return '左側の命題に、タクティクで組み立てる証明を与えます。'
  }
  if (line.endsWith(':= do')) {
    return '副作用を順番に実行するIO処理の本体を始めます。'
  }
  if (line.includes(':=')) {
    return '左側で宣言した名前へ、右側の定義本体を与えます。'
  }
  if (line.includes('=>')) {
    return '左側の入力またはパターンに対する結果を右側へ書きます。'
  }
  if (line.endsWith(':')) {
    return '宣言する型または命題が、次の行へ続きます。'
  }

  return '直前の宣言を継続し、この式を定義本体または命題の一部として使います。'
}

function explainTypeScriptLine(line: string) {
  if (line.startsWith('//')) {
    return '実行されない注釈として、この処理の意図を示します。'
  }
  if (line.startsWith('import ')) {
    return 'Node.jsの別モジュールから、必要な機能を読み込みます。'
  }
  if (line.startsWith('type ')) {
    return 'Leanから受け取る値の形をTypeScriptの型として定義します。'
  }
  if (line.startsWith('export async function ')) {
    return '外部から呼べる非同期関数を宣言し、Promiseで結果を返します。'
  }
  if (line.startsWith('function ')) {
    return '未知の値を実行時に検査する関数を宣言します。'
  }
  if (line.startsWith('const ')) {
    return line.includes('JSON.parse')
      ? '標準出力のJSONを解析し、まだ未検証のunknownとして受け取ります。'
      : '右辺の値を、再代入しない局所変数へ束縛します。'
  }
  if (line.startsWith('if ')) {
    return '期待する条件を満たさない場合を検出し、処理を早期終了します。'
  }
  if (line.startsWith('return ')) {
    return '検証または処理の結果を呼び出し元へ返します。'
  }
  if (line.startsWith('&&')) {
    return '前行の条件に加え、reasonが文字列であることも確認します。'
  }
  if (line === ');') {
    return '複数行に分けた関数呼び出しをここで閉じます。'
  }
  if (line === '}') {
    return 'この関数の処理範囲をここで閉じます。'
  }
  if (line.startsWith('"./')) {
    return 'シェルを介さず直接起動するLean実行ファイルのパスです。'
  }
  if (line === '[role],') {
    return '外部入力を、実行ファイルへ渡す引数の配列にします。'
  }
  if (line.startsWith('{ timeout:')) {
    return '外部プロセスが長時間停止しないよう、実行時間に上限を設けます。'
  }

  return '直前の宣言または関数呼び出しを、この値や条件で継続します。'
}

function explainTomlLine(line: string) {
  if (line.startsWith('#')) {
    return '設定としては読み込まれない注釈です。'
  }
  if (line === '[[lean_exe]]') {
    return 'Leanの実行可能ファイルを作る設定ブロックを始めます。'
  }
  if (line.startsWith('name')) {
    return 'パッケージまたは現在のターゲットの名前を指定します。'
  }
  if (line.startsWith('version')) {
    return 'このパッケージのバージョンを指定します。'
  }
  if (line.startsWith('defaultTargets')) {
    return '通常のビルドで作るターゲットを指定します。'
  }
  if (line.startsWith('root')) {
    return '実行可能ファイルの入口になるLeanモジュールを指定します。'
  }

  return 'Lakeがビルド時に参照する設定値です。'
}

function explainShellLine(line: string) {
  if (line.startsWith('#')) {
    return '直前のコマンドから得られる出力例を示します。'
  }
  if (line.startsWith('lake new ')) {
    return '指定した名前で、練習用のLeanプロジェクトを作成します。'
  }
  if (line.startsWith('cd ')) {
    return '以降のコマンドを実行するディレクトリへ移動します。'
  }
  if (line.startsWith('lake lean ')) {
    return '指定したLeanファイルを読み込み、定義と証明を型検査します。'
  }
  if (line === 'lake build') {
    return 'Leanプロジェクト全体をビルドし、証明を含めて型検査します。'
  }
  if (line.startsWith('./')) {
    return 'ビルド済みのLean実行ファイルへ、この引数を渡して起動します。'
  }
  if (line === 'npm run typecheck') {
    return 'TypeScriptの型検査を実行します。'
  }
  if (line === 'npm test') {
    return 'TypeScriptプロジェクトの自動テストを実行します。'
  }

  return 'このコマンドをシェルで実行し、次の検証段階へ進みます。'
}

export function buildCommentedCode(source: string, language: LeanCodeLanguage = 'lean') {
  const marker = language === 'lean' ? '--' : language === 'typescript' ? '//' : '#'

  return source
    .split('\n')
    .map((sourceLine) => {
      const line = sourceLine.trim()
      if (!line) return sourceLine

      const explanation =
        language === 'lean'
          ? explainLeanLine(line)
          : language === 'typescript'
            ? explainTypeScriptLine(line)
            : language === 'toml'
              ? explainTomlLine(line)
              : explainShellLine(line)
      const markerIndex = sourceLine.indexOf(marker)
      const hasLineComment =
        markerIndex >= 0 && (markerIndex === 0 || /\s/.test(sourceLine[markerIndex - 1]))

      return hasLineComment
        ? `${sourceLine} / ${explanation}`
        : `${sourceLine}  ${marker} ${explanation}`
    })
    .join('\n')
}

export function LeanCode({
  children,
  label = 'Lean',
  status,
  guideOpen = false
}: {
  children: string
  label?: string
  status?: 'accepted' | 'rejected'
  guideOpen?: boolean
}) {
  const language = detectCodeLanguage(label)
  const guide = buildCodeGuide(children, language)
  const commentedCode = buildCommentedCode(children, language)

  return (
    <figure className={`lean-code${status ? ` lean-code--${status}` : ''}`}>
      <figcaption>
        <span>{label}</span>
        {status && (
          <span className="lean-code__status">
            {status === 'accepted' ? 'accepted' : 'not proved'}
          </span>
        )}
      </figcaption>
      <pre>
        <PrismCode code={commentedCode} language={language} />
      </pre>
      {guide.length > 0 && (
        <details className="lean-code__guide" open={guideOpen}>
          <summary>
            <span>コードの読み方</span>
            <small>{guide.length}項目</small>
          </summary>
          <dl>
            {guide.map((item) => (
              <div key={item.token}>
                <dt>
                  <code>{item.token}</code>
                </dt>
                <dd>{item.explanation}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </figure>
  )
}
