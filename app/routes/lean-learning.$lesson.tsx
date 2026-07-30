import { data, Link } from 'react-router'
import {
  BoundaryExercise,
  CheckPipeline,
  ChoiceExercise,
  ProgramVerifier,
  ProofStepper,
  PropositionSwitch
} from '~/components/lean-learning-interactions'
import {
  LeanCode,
  LeanLearningShell,
  LessonHeader,
  LessonPager,
  LessonSection
} from '~/components/lean-learning-shell'
import { getLeanLesson, type LeanLessonSlug } from '~/lib/lean-learning'
import type { Route } from './+types/lean-learning.$lesson'

export function loader({ params }: Route.LoaderArgs) {
  const lesson = getLeanLesson(params.lesson)

  if (!lesson) {
    throw data('Lesson not found', { status: 404 })
  }

  return { lesson }
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.lesson.title ?? 'レッスン'

  return [
    { title: `${title} | Lean入門` },
    {
      name: 'description',
      content: loaderData?.lesson.summary ?? 'Lean初心者向けのインタラクティブ教材です。'
    }
  ]
}

export default function LeanLearningLesson({ loaderData }: Route.ComponentProps) {
  const { lesson } = loaderData

  return (
    <LeanLearningShell currentLesson={lesson}>
      <article className="lesson-article">
        <LessonHeader lesson={lesson} />
        <LessonContent slug={lesson.slug as LeanLessonSlug} />
        <LessonPager lesson={lesson} />
      </article>
    </LeanLearningShell>
  )
}

function LessonContent({ slug }: { slug: LeanLessonSlug }) {
  switch (slug) {
    case 'what-is-lean':
      return <WhatIsLean />
    case 'what-lean-checks':
      return <WhatLeanChecks />
    case 'types-and-functions':
      return <TypesAndFunctions />
    case 'data-and-recursion':
      return <DataAndRecursion />
    case 'dependent-types':
      return <DependentTypes />
    case 'propositions':
      return <Propositions />
    case 'goals-and-tactics':
      return <GoalsAndTactics />
    case 'induction-and-simplification':
      return <InductionAndSimplification />
    case 'verified-program':
      return <VerifiedProgram />
    case 'typescript-integration':
      return <TypeScriptIntegration />
    case 'trust-boundary':
      return <TrustBoundary />
  }
}

function ReferenceLinks({ links }: { links: readonly { label: string; href: string }[] }) {
  return (
    <aside className="reference-links" aria-label="この節に対応する公式リファレンス">
      <span>公式リファレンスで確かめる</span>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>
              {link.label}
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function WhatIsLean() {
  return (
    <>
      <LessonSection label="START HERE" title="Leanには2つの顔がある">
        <p>
          Leanでは、数を足す関数も、数学的な主張も、同じファイルに書けます。 プログラムを実行できる
          <strong>関数型プログラミング言語</strong>であると同時に、主張の証明を支援する
          <strong>対話型定理証明支援系</strong>だからです。
        </p>
        <div className="concept-pair">
          <article>
            <span>PROGRAMMING LANGUAGE</span>
            <h3>値を計算する</h3>
            <LeanCode label="double.lean" guideOpen>
              {'def double (n : Nat) : Nat :=\n  n + n\n\n#eval double 3  -- 6'}
            </LeanCode>
            <p>入力を受け取り、値を返す関数を書けます。</p>
          </article>
          <article>
            <span>THEOREM PROVER</span>
            <h3>主張を確かめる</h3>
            <LeanCode label="double.lean">
              {'theorem double_three :\n    double 3 = 6 := by\n  rfl'}
            </LeanCode>
            <p>関数について述べた命題に、証明を与えられます。</p>
          </article>
        </div>
      </LessonSection>

      <LessonSection label="COMPARE" title="テストや型検査との違い">
        <p>
          一般的な開発道具も、プログラムの誤りを減らします。
          ただし、各手法が確認する対象は同じではありません。
        </p>
        <table className="comparison-table">
          <caption>テスト、型検査、Leanの証明が確認する範囲</caption>
          <thead>
            <tr>
              <th scope="col">方法</th>
              <th scope="col">確認するもの</th>
              <th scope="col">確認しないもの</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">テスト</th>
              <td>選んだ入力で期待した結果になるか</td>
              <td>実行していない入力</td>
            </tr>
            <tr>
              <th scope="row">型検査</th>
              <td>値と操作の型が合っているか</td>
              <td>業務上の意味が正しいか</td>
            </tr>
            <tr className="is-highlighted">
              <th scope="row">Leanの証明</th>
              <td>書いた命題を証明項から導けるか</td>
              <td>命題に書かなかった性質</td>
            </tr>
          </tbody>
        </table>
      </LessonSection>

      <LessonSection label="CORE MODEL" title="Leanのファイルに残る宣言">
        <p>
          Leanはソースコードを上から読み、定義や定理を<strong>環境</strong>へ登録します。
          `def`は計算できる定義を、`theorem`は結果の型が命題である定義を登録します。
          `example`も同じように型検査されますが、名前を付けて環境へ残しません。
        </p>
        <LeanCode label="Declarations.lean">
          {'#check Nat       -- Nat : Type\n#check Nat.succ  -- Nat.succ (n : Nat) : Nat\n\n' +
            'def next (n : Nat) : Nat := n + 1\n' +
            'theorem next_eq_succ (n : Nat) :\n' +
            '    next n = Nat.succ n := by\n' +
            '  rfl\n\n' +
            '#print next_eq_succ'}
        </LeanCode>
        <p>
          `#check`は式の型を表示し、`#print`は登録済みの宣言を表示します。
          エディタのホバーだけに頼らず、この2つを使うと、Leanが推論した型と暗黙引数をソース上で確認できます。
        </p>
      </LessonSection>

      <LessonSection label="RUN LOCALLY" title="コード例を手元のLeanで確かめる">
        <p>
          読むだけでなく出力とエラーを確かめる場合は、公式インストーラでLeanを導入し、Lakeで練習用プロジェクトを作ります。
          各コード例を`Main.lean`へ貼り、`lake lean Main.lean`で型検査できます。
        </p>
        <LeanCode label="terminal">
          {'lake new lean-primer\n' + 'cd lean-primer\n' + 'lake lean Main.lean'}
        </LeanCode>
        <p>
          同じ章で前に定義した名前を使う例は、上から同じファイルへ置いてください。
          第10章のJSON例は、そこに示す`lakefile.toml`と`Main.lean`を組み合わせてビルドします。
        </p>
      </LessonSection>

      <ReferenceLinks
        links={[
          {
            label: 'Definitions',
            href: 'https://lean-lang.org/doc/reference/latest/Definitions/'
          },
          {
            label: 'The Type System',
            href: 'https://lean-lang.org/doc/reference/latest/The-Type-System/'
          }
        ]}
      />

      <LessonSection label="TRY IT" title="Leanに渡すものを見分ける">
        <ChoiceExercise
          question="「プログラムの性質を証明する」に最も近いものはどれでしょう。"
          options={[
            {
              label: '関数を100回実行して、結果をログに残す',
              explanation:
                'これは多くの具体例を実行するテストです。証明する命題はまだ書かれていません。'
            },
            {
              label: 'すべての入力について、返り値が上限を超えないと主張して証明する',
              explanation:
                '「すべての入力」という量化を含む性質を命題として書き、証明をカーネルに確認させます。'
            },
            {
              label: 'コードを読みやすく整形する',
              explanation: '整形はコードの表記を揃えますが、プログラムの性質を証明しません。'
            }
          ]}
          correctIndex={1}
        />
      </LessonSection>

      <aside className="lesson-callout">
        <span>最初の理解</span>
        <p>
          Leanは「正しい答えを自動で考える装置」ではありません。
          開発者が書いた定義と命題に対し、与えられた証明が成立するかを厳密に確認します。
        </p>
      </aside>
    </>
  )
}

function WhatLeanChecks() {
  return (
    <>
      <LessonSection label="PIPELINE" title="「通った」を5段階に分ける">
        <p>
          コードがLeanに受け入れられるまでには、役割の異なる確認があります。
          各段階を選び、同じコードの何を見ているか確かめてください。
        </p>
        <CheckPipeline />
      </LessonSection>

      <LessonSection label="KERNEL" title="最後に証明項だけを確認する">
        <div className="split-copy">
          <div>
            <p>
              タクティクは、証明を組み立てるための便利な命令です。
              `rfl`や`intro`を実行すると、Leanは最終的に<strong>証明項</strong>を作ります。
            </p>
            <p>
              小さな<strong>カーネル</strong>は、その証明項が命題に対応する型を持つかを確認します。
              タクティク自体を無条件に信用しているわけではありません。
            </p>
          </div>
          <div
            className="kernel-diagram"
            role="img"
            aria-label="タクティクから証明項を作り、カーネルが確認する流れ"
          >
            <span>tactic</span>
            <span aria-hidden="true">→</span>
            <span>proof term</span>
            <span aria-hidden="true">→</span>
            <strong>kernel ✓</strong>
          </div>
        </div>
      </LessonSection>

      <LessonSection label="ELABORATION" title="書いた構文とカーネルが読む項は異なる">
        <p>
          開発者が書くLeanコードには、省略された型、記法、マクロ、タクティクが含まれます。
          <strong>エラボレータ</strong>は、それらを明示的なコア言語の項へ変換します。
          カーネルが型検査するのは、元の表記ではなく変換後の項です。
        </p>
        <LeanCode label="同じ証明を2つの表記で書く">
          {'theorem keepLeft₁ (p q : Prop) (hp : p) : q → p := by\n' +
            '  intro _\n' +
            '  exact hp\n\n' +
            'theorem keepLeft₂ (p q : Prop) (hp : p) : q → p :=\n' +
            '  fun _ => hp'}
        </LeanCode>
        <p>
          上の2つは同じ型を持つ証明です。
          タクティクは証明状態を操作するための記法であり、論理へ新しい公理を追加する仕組みではありません。
          最終的には`fun _ =&gt; hp`のような証明項がカーネルへ渡ります。
        </p>
      </LessonSection>

      <LessonSection label="REDUCTION" title="rflが使う定義上の等しさ">
        <p>
          `rfl`は、左右の文字列が同じ場合だけに使う命令ではありません。
          定義の展開、関数適用、パターンマッチなどを計算した結果が同じ項になるとき、 Leanは両辺を
          <strong>定義上等しい</strong>と判定します。
        </p>
        <LeanCode label="Reduction.lean">
          {'def double (n : Nat) : Nat := n + n\n\n' +
            'example : double 2 = 4 := by\n' +
            '  rfl\n\n' +
            'example (α : Type) (x : α) : (fun y => y) x = x := by\n' +
            '  rfl'}
        </LeanCode>
      </LessonSection>

      <ReferenceLinks
        links={[
          {
            label: 'Elaboration and Compilation',
            href: 'https://lean-lang.org/doc/reference/latest/Elaboration-and-Compilation/'
          },
          {
            label: 'Validating Lean Proofs',
            href: 'https://lean-lang.org/doc/reference/latest/ValidatingProofs/'
          }
        ]}
      />

      <LessonSection label="CHECK" title="失敗した段階を特定する">
        <ChoiceExercise
          question="`example : 2 + 2 = 5 := by rfl` は、どこで止まるでしょう。"
          options={[
            {
              label: '文字として読めない',
              explanation: 'このコードはLeanの構文として読めます。'
            },
            {
              label: '命題を作れない',
              explanation: '偽であっても「2 + 2 = 5」は意味のある命題です。'
            },
            {
              label: 'rflがその命題の証明にならない',
              explanation: '両辺を計算しても同じ値にならないため、rflから必要な証明項を作れません。'
            }
          ]}
          correctIndex={2}
        />
      </LessonSection>
    </>
  )
}

function TypesAndFunctions() {
  return (
    <>
      <LessonSection label="VALUES" title="式には型がある">
        <p>
          Leanは式を読むとき、その式がどの種類の値になるかを追跡します。
          `#check`を使うと、Leanが推論した型を確認できます。
        </p>
        <div className="code-stack">
          <LeanCode label="#check">
            {
              '#check 3      -- 3 : Nat\n#check true   -- Bool.true : Bool\n#check "hi"   -- "hi" : String'
            }
          </LeanCode>
          <div className="type-legend">
            <span>
              <code>Nat</code> 自然数
            </span>
            <span>
              <code>Bool</code> 真偽値
            </span>
            <span>
              <code>String</code> 文字列
            </span>
          </div>
        </div>
      </LessonSection>

      <LessonSection label="FUNCTIONS" title="矢印は入力と出力を結ぶ">
        <LeanCode label="Main.lean">
          {'def double (n : Nat) : Nat :=\n  n + n\n\n#check double  -- double (n : Nat) : Nat'}
        </LeanCode>
        <p>
          `Nat → Nat`は、自然数を受け取って自然数を返す関数の型です。
          引数`n`に`Bool`を渡すと、関数の本体を実行する前に型の不一致を検出できます。
        </p>
      </LessonSection>

      <LessonSection label="LAMBDA" title="関数も値として組み立てる">
        <p>
          `fun x =&gt; ...`は無名関数を作る式です。 関数を受け取る関数では、`(Nat → Nat) →
          Nat`のように矢印が入れ子になります。 矢印は右結合なので、`Nat → Nat → Nat`は`Nat → (Nat →
          Nat)`として読みます。
        </p>
        <LeanCode label="Functions.lean">
          {'#check fun (n : Nat) => n + 1\n' +
            '-- fun n => n + 1 : Nat → Nat\n\n' +
            'def twice (f : Nat → Nat) (n : Nat) : Nat :=\n' +
            '  f (f n)\n\n' +
            '#eval twice (fun n => n + 1) 3  -- 5'}
        </LeanCode>
      </LessonSection>

      <LessonSection label="POLYMORPHISM" title="型も引数として受け取る">
        <p>
          同じ処理を複数の型で使うとき、型そのものを引数にします。 波括弧の`{` `}`は
          <strong>暗黙引数</strong>を表し、適用時にLeanが周囲の型から推論します。
        </p>
        <LeanCode label="Polymorphic.lean">
          {'def identity {α : Type} (x : α) : α := x\n\n' +
            '#check identity 3       -- identity 3 : Nat\n' +
            '#check identity "Lean"  -- identity "Lean" : String\n' +
            '#check @identity        -- {α : Type} → α → α'}
        </LeanCode>
        <p>
          名前の前に`@`を付けると暗黙引数を明示できます。
          `α`が`Type`の要素であることと、`x`が`α`の要素であることを分けて読むのが出発点です。
        </p>
      </LessonSection>

      <LessonSection label="TYPE CLASSES" title="利用できる操作を型クラスで要求する">
        <p>
          `#eval`で値を表示できるのは、Leanがその値の表示方法を知っているからです。
          角括弧の引数`[Repr α]`は、型`α`の整形方法を定める`Repr`インスタンスを要求します。
          TypeScriptの構造的型付けとは異なり、Leanは登録されたインスタンスを探索します。
        </p>
        <LeanCode label="TypeClasses.lean">
          {'def render [Repr α] (value : α) : String :=\n' +
            '  reprStr value\n\n' +
            '#eval render [1, 2, 3]\n' +
            '#synth Repr (List Nat)'}
        </LeanCode>
      </LessonSection>

      <LessonSection label="TRY IT" title="関数の型を読む">
        <ChoiceExercise
          question="`def isZero (n : Nat) : Bool := n == 0` の型はどれでしょう。"
          options={[
            {
              label: 'Nat → Bool',
              explanation: '自然数をひとつ受け取り、0かどうかをBoolで返します。'
            },
            {
              label: 'Bool → Nat',
              explanation: '入力と出力の向きが逆です。'
            },
            {
              label: 'Nat → Nat',
              explanation: '返り値は自然数ではなく、比較結果のBoolです。'
            }
          ]}
          correctIndex={0}
        />
      </LessonSection>

      <aside className="lesson-callout lesson-callout--blue">
        <span>型検査の範囲</span>
        <p>
          型が合うことは、操作の組み合わせが整っていることを示します。 `Nat →
          Bool`の関数が、期待した業務ルールを実装していることまでは示しません。
        </p>
      </aside>

      <ReferenceLinks
        links={[
          {
            label: 'Function Types',
            href: 'https://lean-lang.org/doc/reference/latest/The-Type-System/Functions/'
          },
          {
            label: 'Type Classes',
            href: 'https://lean-lang.org/doc/reference/latest/Type-Classes/'
          }
        ]}
      />
    </>
  )
}

function DataAndRecursion() {
  return (
    <>
      <LessonSection label="STRUCTURES" title="複数の値を一つの型にまとめる">
        <p>
          TypeScriptのオブジェクト型に近い入口は`structure`です。
          ただしLeanの構造体は、フィールドを持つ一コンストラクタの帰納型として定義されます。
          宣言すると、コンストラクタと各フィールドの射影関数が環境へ追加されます。
        </p>
        <LeanCode label="Domain.lean">
          {'structure User where\n' +
            '  name : String\n' +
            '  age : Nat\n' +
            '  deriving Repr\n\n' +
            'def ada : User := { name := "Ada", age := 36 }\n\n' +
            '#check User.mk    -- User.mk (name : String) (age : Nat) : User\n' +
            '#check User.name  -- User.name (self : User) : String\n' +
            '#eval ada.age     -- 36'}
        </LeanCode>
      </LessonSection>

      <LessonSection label="INDUCTIVE TYPES" title="値の全パターンをコンストラクタで定める">
        <p>
          複数の形を持つデータは`inductive`で定義します。
          `AccessResult`の値は`granted`、`denied`、`expired`のいずれかであり、
          TypeScriptの判別共用体と同じように場合分けできます。
        </p>
        <LeanCode label="Access.lean">
          {'inductive AccessResult where\n' +
            '  | granted (userId : Nat)\n' +
            '  | denied (reason : String)\n' +
            '  | expired\n' +
            '  deriving Repr\n\n' +
            'def message : AccessResult → String\n' +
            '  | .granted id => s!"user {id}"\n' +
            '  | .denied reason => reason\n' +
            '  | .expired => "expired"'}
        </LeanCode>
        <p>
          パターンマッチはコンストラクタを一つずつ処理します。
          分岐を欠くと網羅性検査が失敗するため、新しいコンストラクタの追加を利用側へ伝えられます。
        </p>
      </LessonSection>

      <LessonSection label="RECURSION" title="再帰関数には停止する根拠が要る">
        <p>
          Leanは通常の再帰的な`def`について、すべての入力で停止する根拠を確認します。
          次の`length`は、再帰呼び出しのたびに`tail`が元のリストより構造的に小さくなるため停止します。
        </p>
        <LeanCode label="Recursion.lean">
          {'def length : List α → Nat\n' +
            '  | [] => 0\n' +
            '  | _ :: tail => 1 + length tail\n\n' +
            '#eval length ["a", "b", "c"]  -- 3'}
        </LeanCode>
        <p>
          Leanが構造的な減少を推論できない再帰では、`termination_by`で減少する尺度を指定します。
          Leanには`partial_fixpoint`、`partial`、`unsafe`という通常とは異なる再帰の定義方法もありますが、
          論理内で使える等式や定義の扱いが通常の全域関数とは異なります。
          この教材では、停止を確認できる通常の定義を扱います。
        </p>
      </LessonSection>

      <ReferenceLinks
        links={[
          {
            label: 'Inductive Types',
            href: 'https://lean-lang.org/doc/reference/latest/The-Type-System/Inductive-Types/'
          },
          {
            label: 'Pattern Matching',
            href: 'https://lean-lang.org/doc/reference/latest/Terms/Pattern-Matching/'
          },
          {
            label: 'Recursive Definitions',
            href: 'https://lean-lang.org/doc/reference/latest/Definitions/Recursive-Definitions/'
          }
        ]}
      />
    </>
  )
}

function DependentTypes() {
  return (
    <>
      <LessonSection label="DEPENDENCY" title="返り値の型が入力を参照する">
        <p>
          通常の関数型`α → β`では、返り値の型`β`は入力値に依存しません。
          <strong>依存関数型</strong>`(x : α) → β x`では、返り値の型が入力`x`を参照します。
          全称量化と依存関数が同じ形を使うのは、この対応によります。
        </p>
        <LeanCode label="Dependent.lean">
          {'def replicateValue (n : Nat) (value : α) : Vector α n :=\n' +
            '  Vector.replicate n value\n\n' +
            '#check replicateValue 3 "Lean"\n' +
            '-- replicateValue 3 "Lean" : Vector String 3'}
        </LeanCode>
        <p>
          引数`n`は`Vector.replicate`の計算に使われ、同じ項が返り値の型`Vector α n`にも現れます。
          ただし、型と証明はコンパイル後のコードから消去されるため、型の添字がそのまま実行時データとして残るとは限りません。
          長さ3のベクタを要求する関数へ長さ2のベクタを渡すと、関数を実行する前に型検査で拒否されます。
        </p>
      </LessonSection>

      <LessonSection label="INDEXED DATA" title="コンストラクタが型の添字を決める">
        <p>
          帰納型の結果型に値を含めると、各コンストラクタが成り立たせる条件を型へ記録できます。
          次の`SizedList α n`では、`nil`の長さは0、`cons`の長さは1増えます。
        </p>
        <LeanCode label="SizedList.lean">
          {'inductive SizedList (α : Type) : Nat → Type where\n' +
            '  | nil : SizedList α 0\n' +
            '  | cons : α → SizedList α n → SizedList α (n + 1)\n\n' +
            'def head : SizedList α (n + 1) → α\n' +
            '  | .cons value _ => value'}
        </LeanCode>
        <p>
          `head`の入力型は長さが1以上であることを表すため、空リストの分岐がありません。
          実装が空配列チェックを省略したのではなく、空の値を呼び出し側が構築できない型になっています。
        </p>
      </LessonSection>

      <LessonSection label="UNIVERSES" title="Typeにも階層がある">
        <p>
          型もLeanの項であり、`Nat : Type`のように型を持ちます。
          自己参照による矛盾を避けるため、実際には`Type 0 : Type 1`、 `Type 1 : Type 2`という
          <strong>宇宙階層</strong>があります。 多相的なライブラリでは`Type u`の宇宙変数を使います。
        </p>
        <LeanCode label="Universes.lean">
          {'universe u\n\n' +
            '#check Nat       -- Nat : Type\n' +
            '#check Type      -- Type : Type 1\n\n' +
            'def keepType (α : Type u) : Type u := α'}
        </LeanCode>
      </LessonSection>

      <ReferenceLinks
        links={[
          {
            label: 'Universes',
            href: 'https://lean-lang.org/doc/reference/latest/The-Type-System/Universes/'
          },
          {
            label: 'Function Types',
            href: 'https://lean-lang.org/doc/reference/latest/The-Type-System/Functions/'
          },
          {
            label: 'Inductive Types',
            href: 'https://lean-lang.org/doc/reference/latest/The-Type-System/Inductive-Types/'
          }
        ]}
      />
    </>
  )
}

function Propositions() {
  return (
    <>
      <LessonSection label="PROP" title="真偽を問える文も型になる">
        <p>
          Leanでは、証明したい主張を<strong>命題</strong>として書きます。
          命題は`Prop`に分類され、その命題の証明は命題に対応する型の値として扱われます。
        </p>
        <div className="proposition-anatomy">
          <div>
            <span>宣言</span>
            <code>example</code>
          </div>
          <div>
            <span>命題</span>
            <code>2 + 2 = 4</code>
          </div>
          <div>
            <span>証明</span>
            <code>by rfl</code>
          </div>
        </div>
      </LessonSection>

      <LessonSection label="BOOL AND PROP" title="Boolの値とPropの命題を分ける">
        <p>
          `Bool`と`Prop`は、どちらも真偽に関係しますが役割が異なります。
          `Bool`の`true`と`false`はプログラムが計算するデータであり、`Prop`は証明する文を分類します。
          `Prop`とその証明はコンパイル後のコードから消去されます。
        </p>
        <LeanCode label="BoolAndProp.lean">
          {'#check true                -- Bool.true : Bool\n' +
            '#check True                -- True : Prop\n' +
            '#check (true = false)      -- true = false : Prop\n' +
            '#eval decide (2 + 2 = 4)  -- true'}
        </LeanCode>
        <p>
          最後の行では、判定可能な命題`2 + 2 = 4`を`decide`で`Bool`へ変換して実行しています。
          たとえば`mayUnlock false =
          false`では、左右の`false`は`Bool`の値ですが、等式全体は`Prop`の命題です。
        </p>
      </LessonSection>

      <LessonSection label="EXPERIMENT" title="偽の命題も書ける">
        <p>
          「命題として正しい形であること」と「命題が真であること」は別です。
          下の式を切り替えて、Leanが受け入れる範囲を確認してください。
        </p>
        <PropositionSwitch />
      </LessonSection>

      <LessonSection label="READ IT" title="コロンの左右を分ける">
        <LeanCode label="Main.lean">{'theorem two_plus_two : 2 + 2 = 4 := by\n  rfl'}</LeanCode>
        <div className="syntax-notes">
          <p>
            <code>two_plus_two</code>
            <span>定理の名前</span>
          </p>
          <p>
            <code>: 2 + 2 = 4</code>
            <span>証明したい命題</span>
          </p>
          <p>
            <code>:= by rfl</code>
            <span>命題に与える証明</span>
          </p>
        </div>
      </LessonSection>

      <LessonSection label="CONNECTIVES" title="論理結合子は証明のデータ構造になる">
        <p>
          `p → q`の証明は`p`の証明を受け取って`q`の証明を返す関数です。 `p ∧
          q`の証明は両方の証明を持ち、`p ∨ q`の証明はどちら側を選んだかとその証明を持ちます。
          `¬p`は`p → False`の略です。
        </p>
        <LeanCode label="Logic.lean">
          {'example (p q : Prop) : p → q → p ∧ q :=\n' +
            '  fun hp hq => And.intro hp hq\n\n' +
            'example (p q : Prop) : p → p ∨ q :=\n' +
            '  fun hp => Or.inl hp\n\n' +
            'example (p : Prop) : ¬p → p → False :=\n' +
            '  fun notP hp => notP hp'}
        </LeanCode>
        <p>
          これは証明項の構成を説明する対応です。
          `And`や`Or`は`Prop`に属するため、通常の積型`Prod`や直和型`Sum`の値とは異なり、
          証明を分岐判定用の実行時データとして自由に取り出すことはできません。
        </p>
      </LessonSection>

      <LessonSection label="QUANTIFIERS" title="全称は関数、存在は証人と証明を持つ">
        <p>
          `∀ x, P x`を証明するには、任意の`x`から`P x`の証明を作る関数を与えます。 `∃ x, P
          x`を証明するには、具体的な値である<strong>証人</strong>
          と、その値で`P`が成り立つ証明を組にします。
        </p>
        <LeanCode label="Quantifiers.lean">
          {'example : ∀ n : Nat, n = n :=\n' +
            '  fun n => Eq.refl n\n\n' +
            'example : ∃ n : Nat, n > 10 := by\n' +
            '  refine ⟨11, ?_⟩\n' +
            '  decide'}
        </LeanCode>
        <p>
          定理が全入力を対象にするか、特定の入力だけを対象にするかは、量化の位置で決まります。
          テストとの違いを判断するときは、タクティクの高度さではなく命題の量化を読みます。
          存在命題も`Prop`に属するため、その証明から証人を一般の実行時データとして取り出すことはできません。
        </p>
      </LessonSection>

      <ReferenceLinks
        links={[
          {
            label: 'Propositions',
            href: 'https://lean-lang.org/doc/reference/latest/The-Type-System/Propositions/'
          },
          {
            label: 'Logical Connectives',
            href: 'https://lean-lang.org/doc/reference/latest/Basic-Propositions/Logical-Connectives/'
          },
          {
            label: 'Quantifiers',
            href: 'https://lean-lang.org/doc/reference/latest/Basic-Propositions/Quantifiers/'
          },
          {
            label: 'Booleans and Propositions',
            href: 'https://lean-lang.org/doc/reference/latest/Basic-Types/Booleans/'
          }
        ]}
      />
    </>
  )
}

function GoalsAndTactics() {
  return (
    <>
      <LessonSection label="PROOF STATE" title="証明途中にはゴールがある">
        <p>
          タクティクモードでは、いま使える仮定が<strong>コンテキスト</strong>
          に、これから証明する命題が
          <strong>ゴール</strong>に表示されます。
          タクティクは、この状態を証明済みの状態へ変える操作です。
        </p>
        <ProofStepper />
      </LessonSection>

      <LessonSection label="TWO MOVES" title="introとexactの役割">
        <div className="tactic-cards">
          <article>
            <code>intro hq</code>
            <h3>前提を受け取る</h3>
            <p>`q → p`を証明するとき、qを仮定`hq`としてコンテキストへ移します。</p>
          </article>
          <article>
            <code>exact hp</code>
            <h3>ゴールそのものを渡す</h3>
            <p>ゴールがpで、コンテキストに`hp : p`があれば、その証明をそのまま使えます。</p>
          </article>
        </div>
      </LessonSection>

      <LessonSection label="GOAL SHAPES" title="ゴールの外側から次の操作を決める">
        <p>
          タクティクは暗記表ではなく、ゴールの最も外側にある型コンストラクタへ対応させて選びます。
          含意や全称には`intro`、連言には`constructor`、存在には`refine ⟨値, ?_⟩`、
          帰納型の仮定には`cases`が候補になります。
        </p>
        <LeanCode label="Tactics.lean">
          {'example (p q : Prop) (hp : p) (hq : q) : p ∧ q := by\n' +
            '  constructor\n' +
            '  · exact hp\n' +
            '  · exact hq\n\n' +
            'example (p q : Prop) (h : p ∧ q) : q := by\n' +
            '  cases h with\n' +
            '  | intro _ hq => exact hq'}
        </LeanCode>
      </LessonSection>

      <LessonSection label="APPLY" title="applyは必要な前提を新しいゴールにする">
        <p>
          コンテキストに`h : p → q`があり、ゴールが`q`なら、`apply h`はゴールを`p`へ変えます。
          `exact h hp`と証明項を直接書く代わりに、足りない引数を後から埋める操作です。
        </p>
        <LeanCode label="Apply.lean">
          {'example (p q : Prop) (h : p → q) (hp : p) : q := by\n' +
            '  apply h\n' +
            '  exact hp\n\n' +
            '-- 同じ証明項\n' +
            'example (p q : Prop) (h : p → q) (hp : p) : q :=\n' +
            '  h hp'}
        </LeanCode>
      </LessonSection>

      <LessonSection label="CHECK" title="次の一手を選ぶ">
        <ChoiceExercise
          question="コンテキストに `h : p` があり、ゴールが `p` のとき、何を実行しますか。"
          options={[
            {
              label: 'intro h',
              explanation: 'introは、ゴールが関数型や含意になっているときに前提を受け取る操作です。'
            },
            {
              label: 'exact h',
              explanation: 'hの型とゴールがどちらもpなので、hを証明として渡せます。'
            },
            {
              label: 'rfl',
              explanation: 'このゴールが等式だとは限らないため、反射律を使う場面ではありません。'
            }
          ]}
          correctIndex={1}
        />
      </LessonSection>

      <ReferenceLinks
        links={[
          {
            label: 'The Tactic Language',
            href: 'https://lean-lang.org/doc/reference/latest/Tactic-Proofs/The-Tactic-Language/'
          },
          {
            label: 'Tactic Reference',
            href: 'https://lean-lang.org/doc/reference/latest/Tactic-Proofs/Tactic-Reference/'
          }
        ]}
      />
    </>
  )
}

function InductionAndSimplification() {
  return (
    <>
      <LessonSection label="INDUCTION" title="再帰的な値はコンストラクタごとに証明する">
        <p>
          自然数は`zero`または`succ n`、リストは`nil`または`cons head tail`で作られます。
          帰納法は各コンストラクタの場合を証明し、再帰的な引数には
          <strong>帰納法の仮定</strong>を使えるようにします。
        </p>
        <LeanCode label="Induction.lean">
          {'def append : List α → List α → List α\n' +
            '  | [], ys => ys\n' +
            '  | x :: xs, ys => x :: append xs ys\n\n' +
            'theorem append_nil (xs : List α) : append xs [] = xs := by\n' +
            '  induction xs with\n' +
            '  | nil =>\n' +
            '      rfl\n' +
            '  | cons head tail ih =>\n' +
            '      simp [append, ih]'}
        </LeanCode>
        <p>
          `nil`分岐では両辺を計算すると同じ形になります。 `cons`分岐では`append tail [] =
          tail`という帰納法の仮定`ih`を使い、 この例で定義した`append`を簡約します。
        </p>
      </LessonSection>

      <LessonSection label="EQUALITY" title="rfl、rw、simpの役割を分ける">
        <div className="tactic-cards">
          <article>
            <code>rfl</code>
            <h3>定義上の等しさを閉じる</h3>
            <p>両辺を定義に従って計算し、同じ項になる場合に証明します。</p>
          </article>
          <article>
            <code>rw [h]</code>
            <h3>指定した等式で書き換える</h3>
            <p>`h : a = b`を使って、ゴール中の`a`を`b`へ明示的に置き換えます。</p>
          </article>
          <article>
            <code>simp [h]</code>
            <h3>簡約規則を繰り返し適用する</h3>
            <p>登録済みのsimp補題と指定した定義や定理を、単純になる向きへ適用します。</p>
          </article>
        </div>
      </LessonSection>

      <LessonSection label="CONTROL" title="自動化に渡した規則を読める形にする">
        <p>
          `simp`は便利ですが、何を使ったかが不明なままでは証明の保守が難しくなります。
          学習中や境界の厳しい証明では`simp only [...]`で規則を限定すると、
          インポート変更によるsimp集合の変化を受けにくくなります。
        </p>
        <LeanCode label="ControlledSimp.lean">
          {'theorem append_nil_explicit (xs : List α) : append xs [] = xs := by\n' +
            '  induction xs with\n' +
            '  | nil => rfl\n' +
            '  | cons head tail ih =>\n' +
            '      simp only [append, ih]'}
        </LeanCode>
      </LessonSection>

      <ReferenceLinks
        links={[
          {
            label: 'The induction Tactic',
            href: 'https://lean-lang.org/doc/reference/latest/Tactic-Proofs/The-Tactic-Language/'
          },
          {
            label: 'Invoking the Simplifier',
            href: 'https://lean-lang.org/doc/reference/latest/The-Simplifier/Invoking-the-Simplifier/'
          },
          {
            label: 'Simp Sets',
            href: 'https://lean-lang.org/doc/reference/latest/The-Simplifier/Simp-sets/'
          }
        ]}
      />
    </>
  )
}

function VerifiedProgram() {
  return (
    <>
      <LessonSection label="SPECIFICATION" title="関数に性質を結び付ける">
        <p>
          関数を書いただけでは、開発者が期待する安全条件はコードに現れません。
          そこで「有効な鍵がなければ解錠しない」を命題として追加します。
        </p>
        <ProgramVerifier />
      </LessonSection>

      <LessonSection label="REGRESSION" title="実装が変わると証明をやり直す">
        <p>
          定理は実装の定義を参照しています。
          実装を「常に解錠する」形へ変えると、同じ証明は通りません。
          これは、書いた安全条件を壊す変更を型検査時に検出した状態です。
        </p>
        <div className="test-proof-compare">
          <article>
            <span>TEST</span>
            <strong>選んだ例を実行する</strong>
            <code>expect(mayUnlock(false)).toBe(false)</code>
            <p>調べたい入力を開発者が選びます。</p>
          </article>
          <article>
            <span>PROOF</span>
            <strong>命題を導く証拠を作る</strong>
            <code>theorem noKeyNoUnlock : ...</code>
            <p>命題が量化を含めば、有限個の例に限らない性質も扱えます。</p>
          </article>
        </div>
      </LessonSection>

      <LessonSection label="UNIVERSAL SPEC" title="すべての入力に対する性質を書く">
        <p>
          一つの具体例を証明しただけでは、未確認の入力へ保証を広げられません。
          実装全体の性質を述べるなら、入力を全称量化し、必要な前提を命題へ含めます。
        </p>
        <LeanCode label="Policy.lean">
          {'inductive Role where\n' +
            '  | guest | member | admin\n' +
            '  deriving DecidableEq\n\n' +
            'def mayDelete : Role → Bool\n' +
            '  | .admin => true\n' +
            '  | _ => false\n\n' +
            'theorem delete_implies_admin (role : Role) :\n' +
            '    mayDelete role = true → role = .admin := by\n' +
            '  cases role <;> simp [mayDelete]'}
        </LeanCode>
        <p>
          この定理は、`mayDelete role = true`なら`role =
          .admin`であることを全`role`について述べます。
          「adminなら削除できる」という逆向きの性質や、認証情報が正しいことは別の命題です。
        </p>
      </LessonSection>

      <LessonSection label="SPEC DESIGN" title="必要条件と十分条件を混同しない">
        <p>
          `A → B`を証明しても`B → A`は得られません。 実装と仕様が双方向に一致することを求めるなら`A
          ↔ B`、 返り値そのものを固定するなら等式を使います。
          仕様の強さは証明手法ではなく命題の形で決まります。
        </p>
        <LeanCode label="StrongerSpec.lean">
          {'theorem mayDelete_iff_admin (role : Role) :\n' +
            '    mayDelete role = true ↔ role = .admin := by\n' +
            '  cases role <;> simp [mayDelete]'}
        </LeanCode>
      </LessonSection>

      <aside className="lesson-callout">
        <span>この例で証明したこと</span>
        <p>
          証明したのは「この関数にfalseを渡すとfalseが返る」です。
          現実の鍵センサーや錠前の故障まで証明したわけではありません。
        </p>
      </aside>

      <ReferenceLinks
        links={[
          {
            label: 'Quantifiers',
            href: 'https://lean-lang.org/doc/reference/latest/Basic-Propositions/Quantifiers/'
          },
          {
            label: 'Propositional Equality',
            href: 'https://lean-lang.org/doc/reference/latest/Basic-Propositions/Propositional-Equality/'
          }
        ]}
      />
    </>
  )
}

function TypeScriptIntegration() {
  return (
    <>
      <LessonSection label="ARCHITECTURE" title="LeanとTypeScriptの責務を分ける">
        <p>
          Leanの公式ツールチェーンはLeanコードをビルドし、実行可能ファイルやライブラリを生成します。
          TypeScriptから利用する堅い入口は、Leanを直接`import`する形ではなく、
          <strong>ビルド時の検証</strong>と<strong>プロセス境界での実行</strong>を分ける構成です。
        </p>
        <ol className="reading-steps">
          <li>
            <strong>Leanでドメインの定義と定理を書く</strong>
            <span>`lake build`が定義、命題、証明を型検査します。</span>
          </li>
          <li>
            <strong>計算する部分だけをLeanの実行可能ファイルにする</strong>
            <span>証明はコンパイル時に検査され、`Prop`の証明項は実行コードから消去されます。</span>
          </li>
          <li>
            <strong>TypeScriptはJSONを未知の外部入力として検証する</strong>
            <span>TypeScriptの型注釈だけでは、別プロセスから届く値を検証できません。</span>
          </li>
        </ol>
      </LessonSection>

      <LessonSection label="LEAN CLI" title="証明済みの判定をJSONで返す">
        <p>
          アクセス判定をLean側に置き、判定関数について性質を証明します。
          `main`はコマンドライン引数を受け取り、TypeScriptが読めるJSONを標準出力へ一行だけ出します。
        </p>
        <LeanCode label="Main.lean">
          {'import Lean.Data.Json\n\n' +
            'structure Verdict where\n' +
            '  allowed : Bool\n' +
            '  reason : String\n' +
            '  deriving Lean.ToJson\n\n' +
            'def decideAccess (role : String) : Verdict :=\n' +
            '  if role == "admin" then\n' +
            '    { allowed := true, reason := "admin" }\n' +
            '  else\n' +
            '    { allowed := false, reason := "role is not admin" }\n\n' +
            'theorem nonAdminDenied (role : String)\n' +
            '    (h : role ≠ "admin") :\n' +
            '    (decideAccess role).allowed = false := by\n' +
            '  simp [decideAccess, h]\n\n' +
            'def main (args : List String) : IO Unit := do\n' +
            '  let role := args.head?.getD ""\n' +
            '  IO.println (Lean.toJson (decideAccess role)).compress'}
        </LeanCode>
        <p>
          定理が保証するのは`role ≠ "admin"`という前提の下で`allowed = false`になることです。
          文字列`role`が信頼できる認証処理から来たことまでは、この定理に含まれません。
        </p>
      </LessonSection>

      <LessonSection label="LAKE" title="Lakeで実行可能ファイルを固定してビルドする">
        <p>
          LakeはLean標準のビルドツールです。
          ツールチェーンのバージョンを`lean-toolchain`へ固定し、`lakefile.toml`で実行可能ターゲットを宣言します。
          Lakeが生成する`lake-manifest.json`は依存関係の取得元とバージョンを固定するため、通常はリポジトリへ含めます。
          依存関係を変更したときは`lake update`でマニフェストを更新します。
        </p>
        <LeanCode label="lakefile.toml">
          {'name = "access-policy"\n' +
            'version = "0.1.0"\n' +
            'defaultTargets = ["access-policy"]\n\n' +
            '[[lean_exe]]\n' +
            'name = "access-policy"\n' +
            'root = "Main"'}
        </LeanCode>
        <LeanCode label="build">
          {'lake build\n' +
            './.lake/build/bin/access-policy admin\n' +
            '# {"allowed":true,"reason":"admin"}'}
        </LeanCode>
      </LessonSection>

      <LessonSection label="TYPESCRIPT" title="execFileと実行時検証で境界を閉じる">
        <p>
          Node.js側ではシェル文字列を組み立てず、`execFile`へ実行ファイルと引数を分けて渡します。
          JSON.parseの結果は`unknown`として受け取り、フィールドを検査してから`Verdict`として扱います。
        </p>
        <LeanCode label="policy.ts">
          {'import { execFile } from "node:child_process";\n' +
            'import { promisify } from "node:util";\n\n' +
            'const execFileAsync = promisify(execFile);\n\n' +
            'type Verdict = { allowed: boolean; reason: string };\n\n' +
            'function isVerdict(value: unknown): value is Verdict {\n' +
            '  if (typeof value !== "object" || value === null) return false;\n' +
            '  const item = value as Record<string, unknown>;\n' +
            '  return typeof item.allowed === "boolean"\n' +
            '    && typeof item.reason === "string";\n' +
            '}\n\n' +
            'export async function decideAccess(role: string): Promise<Verdict> {\n' +
            '  const { stdout } = await execFileAsync(\n' +
            '    "./lean-policy/.lake/build/bin/access-policy",\n' +
            '    [role],\n' +
            '    { timeout: 2_000 }\n' +
            '  );\n' +
            '  const result: unknown = JSON.parse(stdout);\n' +
            '  if (!isVerdict(result)) throw new Error("Invalid Lean response");\n' +
            '  return result;\n' +
            '}'}
        </LeanCode>
        <p>
          `as Verdict`だけで済ませると、Lean側の出力変更を実行時に見逃します。
          スキーマ検証を境界に置けば、LeanとTypeScriptの変更を独立に検出できます。
        </p>
      </LessonSection>

      <LessonSection label="CI" title="実行時連携が不要ならCIだけで使える">
        <p>
          多くのTypeScriptプロジェクトでは、Leanを本番プロセスから呼ぶ必要はありません。
          仕様モデルと証明を`lean-policy/`へ置き、CIで`lake build`を必須にするだけでも、
          仕様と定理が同時に成立しない変更をマージ前に拒否できます。
        </p>
        <LeanCode label="CIの責務">
          {'npm run typecheck\n' + 'npm test\n' + 'cd lean-policy\n' + 'lake build'}
        </LeanCode>
        <div className="lesson-callout lesson-callout--blue">
          <span>選び方</span>
          <p>
            仕様の整合性だけを検査するならCI統合を選びます。
            Leanで計算した結果をアプリケーションが必要とする場合だけ、CLIとJSONの実行時境界を追加します。
            C
            ABIを使うFFIは可能ですが、公式リファレンスでも現行インターフェースは不安定とされているため、
            最初の統合手段にはしません。
          </p>
        </div>
      </LessonSection>

      <ReferenceLinks
        links={[
          {
            label: 'Lake',
            href: 'https://lean-lang.org/doc/reference/latest/Build-Tools-and-Distribution/Lake/'
          },
          {
            label: 'Foreign Function Interface',
            href: 'https://lean-lang.org/doc/reference/latest/Run-Time-Code/Foreign-Function-Interface/'
          },
          {
            label: 'Propositions are erased at run time',
            href: 'https://lean-lang.org/doc/reference/latest/The-Type-System/Propositions/'
          }
        ]}
      />
    </>
  )
}

function TrustBoundary() {
  return (
    <>
      <LessonSection label="BOUNDARY" title="証明には前提と範囲がある">
        <p>
          Leanのカーネルが証明を受け入れたとき、その結果は強い根拠になります。
          ただし、結果の意味は、形式化した命題、定義、仮定、インポートしたライブラリに依存します。
        </p>
        <div className="trust-map">
          <div className="trust-map__proved">
            <span>LEANが確認する範囲</span>
            <strong>定義</strong>
            <span aria-hidden="true">+</span>
            <strong>命題</strong>
            <span aria-hidden="true">+</span>
            <strong>証明項</strong>
            <span aria-hidden="true">→</span>
            <strong className="is-kernel">kernel ✓</strong>
          </div>
          <div className="trust-map__outside">
            <span>別に確認する範囲</span>
            <small>仕様は意図を表しているか</small>
            <small>入力元は信頼できるか</small>
            <small>外部サービスは動くか</small>
            <small>ハードウェアは故障しないか</small>
          </div>
        </div>
      </LessonSection>

      <LessonSection label="THREE LIMITS" title="見落としやすい3つの境界">
        <div className="limit-list">
          <article>
            <span>01</span>
            <div>
              <h3>仕様のずれ</h3>
              <p>間違った命題を正しく証明しても、開発者が本当に守りたかった性質には届きません。</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>仮定と依存コード</h3>
              <p>証明は、使った公理やインポートした定義と定理を前提にしています。</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>外部世界</h3>
              <p>
                ファイル、ネットワーク、センサーなどの挙動は、モデルに含めた範囲でしか推論できません。
              </p>
            </div>
          </article>
        </div>
      </LessonSection>

      <LessonSection label="AUDIT" title="定理が依存する公理を表示する">
        <p>
          `#print axioms 定理名`を使うと、その定理が最終的に依存する公理を確認できます。
          `sorry`は未完成の証明を一時的に通す仕組みであり、`sorryAx`への依存として表示されます。
          本番で「証明済み」と呼ぶ定理に`sorryAx`が残っていてはいけません。
        </p>
        <LeanCode label="Audit.lean">
          {'theorem unfinished : 2 + 2 = 4 := by\n' +
            '  sorry\n\n' +
            '#print axioms unfinished\n' +
            "-- 'unfinished' depends on axioms: [sorryAx]"}
        </LeanCode>
        <p>
          公理の一覧は空でなければならないわけではありません。
          `propext`、`Classical.choice`、`Quot.sound`はLeanの標準的な公理ですが、
          独自に追加した公理があれば、その公理を前提とする保証だと明記する必要があります。
        </p>
        <p>
          `unsafe`な定義は実行コードには使えますが、定理の証明項には使えません。
          ただし、FFI先の実装や実行環境が正しいことはカーネルの型検査から外れるため、
          実行時の信頼境界として別に監査します。
        </p>
      </LessonSection>

      <LessonSection label="CHECKLIST" title="「証明済み」を説明するための確認項目">
        <ol className="reading-steps">
          <li>
            <strong>命題</strong>
            <span>必要な入力が量化され、前提と結論の向きが意図と一致しているか。</span>
          </li>
          <li>
            <strong>定義と依存</strong>
            <span>命題が参照するモデル、ライブラリ、型クラスの実装が意図どおりか。</span>
          </li>
          <li>
            <strong>公理</strong>
            <span>`#print axioms`で`sorryAx`や採用した追加公理への依存を把握しているか。</span>
          </li>
          <li>
            <strong>外部境界</strong>
            <span>
              入力検証、FFI、ネットワーク、永続化、ハードウェアを別の手段で確認しているか。
            </span>
          </li>
        </ol>
      </LessonSection>

      <LessonSection label="FINAL" title="保証できる範囲を選ぶ">
        <BoundaryExercise />
      </LessonSection>

      <div className="course-complete">
        <span aria-hidden="true">⊢</span>
        <div>
          <p>COURSE COMPLETE</p>
          <h2>証明は、書いた主張を強くする。</h2>
          <p>
            だからこそ、何を主張として書いたかを確認する必要があります。
            Leanは、その境界を曖昧にせず扱うための言語です。
          </p>
          <div>
            <a href="https://lean-lang.org/install/">
              Leanを実際に始める
              <span aria-hidden="true">↗</span>
            </a>
            <Link to="/app/lean-learning">レッスン一覧へ戻る</Link>
          </div>
        </div>
      </div>

      <ReferenceLinks
        links={[
          {
            label: 'Axioms',
            href: 'https://lean-lang.org/doc/reference/latest/Axioms/'
          },
          {
            label: 'Validating Lean Proofs',
            href: 'https://lean-lang.org/doc/reference/latest/ValidatingProofs/'
          },
          {
            label: 'Foreign Function Interface',
            href: 'https://lean-lang.org/doc/reference/latest/Run-Time-Code/Foreign-Function-Interface/'
          }
        ]}
      />
    </>
  )
}
