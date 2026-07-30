export type LeanLesson = {
  slug: string
  number: number
  title: string
  shortTitle: string
  summary: string
  outcome: string
}

export const leanReferenceAudit = {
  version: '4.33.0-rc1',
  checkedAt: '2026-07-30',
  checkedAtLabel: '2026年7月30日',
  href: 'https://lean-lang.org/doc/reference/latest/'
} as const

export const leanLessons = [
  {
    slug: 'what-is-lean',
    number: 1,
    title: 'そもそもLeanとは何か',
    shortTitle: 'Leanとは',
    summary: 'プログラミング言語と定理証明支援系という、Leanの2つの顔を知る。',
    outcome: 'Leanで何を書き、何を確かめられるのかを説明できる。'
  },
  {
    slug: 'what-lean-checks',
    number: 2,
    title: 'Leanは何を確認するのか',
    shortTitle: '確認の流れ',
    summary: '構文、型、命題、証明を区別し、カーネルまでの流れを追う。',
    outcome: '「コードが通った」という言葉を、確認段階ごとに区別できる。'
  },
  {
    slug: 'types-and-functions',
    number: 3,
    title: '値と型から始める',
    shortTitle: '値と型',
    summary: '関数型、ラムダ式、暗黙引数、型クラスを通して、Leanが式をどう読むかを追う。',
    outcome: '関数の型と適用を読み、推論された引数を#checkと#printで確認できる。'
  },
  {
    slug: 'data-and-recursion',
    number: 4,
    title: 'データ型と再帰を定義する',
    shortTitle: 'データ型と再帰',
    summary: '構造体、帰納型、パターンマッチ、停止性検査を一つの例でつなぐ。',
    outcome: 'コンストラクタから値を作り、場合分けと再帰で処理する関数を読める。'
  },
  {
    slug: 'dependent-types',
    number: 5,
    title: '値に依存する型を読む',
    shortTitle: '依存型',
    summary: '通常の関数型から依存関数型へ進み、型が値を参照する意味を確かめる。',
    outcome: '暗黙引数、依存関数、添字付きデータ型が何を表すか説明できる。'
  },
  {
    slug: 'propositions',
    number: 6,
    title: '命題を型として読む',
    shortTitle: '命題と証明',
    summary: '含意、連言、選言、否定、全称量化、存在量化を型として読み分ける。',
    outcome: '論理結合子と量化を、証明項に必要な入力と出力として読める。'
  },
  {
    slug: 'goals-and-tactics',
    number: 7,
    title: 'ゴールを一手ずつ変える',
    shortTitle: 'ゴールとタクティク',
    summary: '証明項とタクティクの対応を確認し、ゴールとコンテキストを操作する。',
    outcome: 'intro、exact、apply、constructor、casesをゴールの形から選べる。'
  },
  {
    slug: 'induction-and-simplification',
    number: 8,
    title: '帰納法と簡約で証明する',
    shortTitle: '帰納法と簡約',
    summary: '再帰的なデータに対する帰納法と、rfl、rw、simpの役割を区別する。',
    outcome: '基底部と帰納部を読み、簡約規則を制御しながら等式を証明できる。'
  },
  {
    slug: 'verified-program',
    number: 9,
    title: 'プログラムの性質を証明する',
    shortTitle: 'プログラム検証',
    summary: '仕様を量化された定理として書き、実装変更と証明の関係を確認する。',
    outcome: '例示テスト、不変条件、形式仕様が担う保証の違いを説明できる。'
  },
  {
    slug: 'typescript-integration',
    number: 10,
    title: 'TypeScript開発へ組み込む',
    shortTitle: 'TypeScript連携',
    summary: 'Leanの検証をCIに置き、実行可能ファイルとJSONを境界にTypeScriptから利用する。',
    outcome: '開発時検証と実行時連携を分け、型安全なプロセス境界を設計できる。'
  },
  {
    slug: 'trust-boundary',
    number: 11,
    title: '証明の外側を見落とさない',
    shortTitle: '保証の境界',
    summary: '公理、sorry、unsafe、FFI、依存コード、外部世界を分けて信頼境界を確かめる。',
    outcome: '#print axiomsを使い、「Leanで証明済み」が意味する範囲を説明できる。'
  }
] as const satisfies readonly LeanLesson[]

export type LeanLessonSlug = (typeof leanLessons)[number]['slug']

export function getLeanLesson(slug: string | undefined): LeanLesson | undefined {
  return leanLessons.find((lesson) => lesson.slug === slug)
}

export function getLeanLessonNeighbors(slug: string) {
  const index = leanLessons.findIndex((lesson) => lesson.slug === slug)

  return {
    previous: index > 0 ? leanLessons[index - 1] : undefined,
    next: index >= 0 && index < leanLessons.length - 1 ? leanLessons[index + 1] : undefined
  }
}

export function leanLessonHref(slug: string) {
  return `/app/lean-learning/${slug}`
}
