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
        <PrismCode code={children} language={language} />
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
