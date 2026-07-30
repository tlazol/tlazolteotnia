import { useState } from 'react'
import { LeanCode } from '~/components/lean-learning-shell'
import { PrismCode, PrismTokens } from '~/components/lean-syntax-highlight'

export function ProofPipeline() {
  const stages = [
    {
      tab: '1. 主張',
      label: 'proposition',
      title: '解錠してよい条件を書く',
      body: '「有効な鍵がないなら、解錠しない」をLeanが読める命題にします。',
      code: 'mayUnlock false = false'
    },
    {
      tab: '2. 証明',
      label: 'proof',
      title: 'その主張を導く手順を書く',
      body: 'rflは、両辺を計算すると同じ形になることを使います。',
      code: 'by\n  rfl'
    },
    {
      tab: '3. 確認',
      label: 'kernel',
      title: '小さなカーネルが検査する',
      body: '証明手順から作られた証明項が、主張の型を持つかを確認します。',
      code: '✓ proof accepted'
    }
  ] as const
  const [stage, setStage] = useState(0)
  const current = stages[stage]

  return (
    <div className="proof-pipeline">
      <div className="proof-pipeline__tabs" role="tablist" aria-label="証明の流れ">
        {stages.map((item, index) => (
          <button
            key={item.tab}
            type="button"
            role="tab"
            aria-selected={stage === index}
            className={stage === index ? 'is-active' : undefined}
            onClick={() => setStage(index)}
          >
            {item.tab}
          </button>
        ))}
      </div>
      <div className="proof-pipeline__workspace">
        <div className="proof-pipeline__source">
          <span className="proof-pipeline__file">Access.lean</span>
          <pre>
            <code className="language-lean">
              <PrismTokens
                code={
                  'def mayUnlock (hasValidKey : Bool) : Bool :=\n  hasValidKey\n\ntheorem noKeyNoUnlock :\n  '
                }
                language="lean"
              />
              <mark className={stage === 0 ? 'is-lit' : undefined}>
                <PrismTokens code="mayUnlock false = false" language="lean" />
              </mark>
              <PrismTokens code={' :=\n  '} language="lean" />
              <mark className={stage === 1 ? 'is-lit' : undefined}>
                <PrismTokens code={'by\n    rfl'} language="lean" />
              </mark>
            </code>
          </pre>
        </div>
        <div className="proof-pipeline__connector" aria-hidden="true">
          <span className={stage === 2 ? 'is-complete' : undefined}>→</span>
        </div>
        <div
          className={`proof-pipeline__goal proof-pipeline__goal--${current.label}`}
          role="tabpanel"
        >
          <span>{current.label}</span>
          <strong>{current.title}</strong>
          <code className="language-lean">
            <PrismTokens code={current.code} language="lean" />
          </code>
          <p>{current.body}</p>
        </div>
      </div>
      <div className="proof-pipeline__controls">
        <span>
          {stage + 1} / {stages.length}
        </span>
        <button
          type="button"
          onClick={() => setStage((currentStage) => (currentStage + 1) % stages.length)}
        >
          {stage === stages.length - 1 ? '最初から見る' : '次へ進む'}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}

type ChoiceOption = {
  label: string
  explanation: string
}

export function ChoiceExercise({
  eyebrow = 'TRY IT',
  question,
  options,
  correctIndex
}: {
  eyebrow?: string
  question: string
  options: readonly ChoiceOption[]
  correctIndex: number
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const isCorrect = selected === correctIndex

  return (
    <div className="lean-exercise">
      <span className="lean-exercise__eyebrow">{eyebrow}</span>
      <h3>{question}</h3>
      <div className="choice-grid">
        {options.map((option, index) => (
          <button
            key={option.label}
            type="button"
            className={selected === index ? (isCorrect ? 'is-correct' : 'is-wrong') : undefined}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <span>{String.fromCharCode(65 + index)}</span>
            {option.label}
          </button>
        ))}
      </div>
      <div
        className={`exercise-feedback${selected === null ? '' : isCorrect ? ' is-correct' : ' is-wrong'}`}
        aria-live="polite"
      >
        {selected === null ? (
          <p>選択肢をひとつ選んでください。</p>
        ) : (
          <>
            <strong>{isCorrect ? 'その理解で合っています。' : 'ここは区別が必要です。'}</strong>
            <p>{options[selected].explanation}</p>
            <button type="button" onClick={() => setSelected(null)}>
              選び直す
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function CheckPipeline() {
  const steps = [
    {
      label: '文字と構文',
      state: 'accepted',
      detail: '予約語や括弧の並びを読み、Leanの式として組み立てます。'
    },
    {
      label: '型',
      state: 'accepted',
      detail: 'mayUnlockはBoolを受け取り、Boolを返す関数だと確認します。'
    },
    {
      label: '命題',
      state: 'accepted',
      detail: 'mayUnlock false = false は、真偽を問える命題です。'
    },
    {
      label: '証明項',
      state: 'accepted',
      detail: 'rflから、この命題を示す証明項を組み立てます。'
    },
    {
      label: 'カーネル',
      state: 'checked',
      detail: '証明項が命題の型を持つことを、Leanの小さな中核が確認します。'
    }
  ] as const
  const [active, setActive] = useState(0)

  return (
    <div className="check-pipeline">
      <ol>
        {steps.map((step, index) => (
          <li key={step.label}>
            <button
              type="button"
              className={active === index ? 'is-active' : undefined}
              onClick={() => setActive(index)}
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <small>{step.state === 'checked' ? 'kernel checked' : 'accepted'}</small>
            </button>
          </li>
        ))}
      </ol>
      <div className="check-pipeline__detail" aria-live="polite">
        <span>STEP {active + 1}</span>
        <strong>{steps[active].label}</strong>
        <p>{steps[active].detail}</p>
      </div>
    </div>
  )
}

export function PropositionSwitch() {
  const [valid, setValid] = useState(true)

  return (
    <div className="proposition-switch">
      <fieldset className="segmented-control">
        <legend className="lean-sr-only">命題を切り替える</legend>
        <button
          type="button"
          className={valid ? 'is-active' : undefined}
          aria-pressed={valid}
          onClick={() => setValid(true)}
        >
          2 + 2 = 4
        </button>
        <button
          type="button"
          className={!valid ? 'is-active' : undefined}
          aria-pressed={!valid}
          onClick={() => setValid(false)}
        >
          2 + 2 = 5
        </button>
      </fieldset>
      <LeanCode label="Main.lean" status={valid ? 'accepted' : 'rejected'}>
        {valid ? 'example : 2 + 2 = 4 := by\n  rfl' : 'example : 2 + 2 = 5 := by\n  rfl'}
      </LeanCode>
      <div className={`proposition-switch__result ${valid ? 'is-valid' : 'is-invalid'}`}>
        <strong>{valid ? '証明が成立します' : 'rflでは証明できません'}</strong>
        <p>
          {valid
            ? '両辺を計算すると同じ値になるため、反射律を使えます。'
            : '左辺は4、右辺は5です。命題を書くことはできても、偽の命題をrflで証明することはできません。'}
        </p>
      </div>
    </div>
  )
}

export function ProofStepper() {
  const states = [
    {
      action: 'intro hq',
      context: 'hp : p',
      goal: 'q → p',
      note: 'ゴールは「qならばp」です。まずqを仮定として受け取ります。'
    },
    {
      action: 'exact hp',
      context: 'hp : p\nhq : q',
      goal: 'p',
      note: 'qが仮定に移り、ゴールはpになりました。仮定hpがそのまま使えます。'
    },
    {
      action: 'done',
      context: 'no goals',
      goal: '✓',
      note: 'hpがゴールのpと一致し、証明が完了しました。hqを使う必要はありません。'
    }
  ] as const
  const [step, setStep] = useState(0)
  const current = states[step]
  const code = `example (p q : Prop) (hp : p) : q → p := by
${step >= 1 ? '  intro hq' : '  _'}
${step >= 2 ? '  exact hp' : '  _'}`

  return (
    <div className="proof-stepper">
      <div className="proof-stepper__code">
        <span>Main.lean</span>
        <pre>
          <PrismCode code={code} language="lean" />
        </pre>
      </div>
      <div className="proof-state">
        <div>
          <span>CONTEXT</span>
          <pre>
            <PrismCode code={current.context} language="lean" />
          </pre>
        </div>
        <div>
          <span>GOAL</span>
          <strong>{current.goal}</strong>
        </div>
        <p>{current.note}</p>
      </div>
      <div className="proof-stepper__action">
        <span>次の操作</span>
        {step < states.length - 1 ? (
          <button type="button" onClick={() => setStep((currentStep) => currentStep + 1)}>
            {current.action}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button type="button" onClick={() => setStep(0)}>
            最初から試す
          </button>
        )}
      </div>
    </div>
  )
}

export function ProgramVerifier() {
  const [broken, setBroken] = useState(false)

  return (
    <div className="program-verifier">
      <fieldset className="segmented-control">
        <legend className="lean-sr-only">実装を切り替える</legend>
        <button
          type="button"
          className={!broken ? 'is-active' : undefined}
          aria-pressed={!broken}
          onClick={() => setBroken(false)}
        >
          元の実装
        </button>
        <button
          type="button"
          className={broken ? 'is-active' : undefined}
          aria-pressed={broken}
          onClick={() => setBroken(true)}
        >
          バグを入れる
        </button>
      </fieldset>
      <div className="program-verifier__grid">
        <LeanCode label="Access.lean" status={broken ? 'rejected' : 'accepted'}>
          {broken
            ? 'def mayUnlock (hasValidKey : Bool) : Bool :=\n  true\n\ntheorem noKeyNoUnlock :\n    mayUnlock false = false := by\n  rfl'
            : 'def mayUnlock (hasValidKey : Bool) : Bool :=\n  hasValidKey\n\ntheorem noKeyNoUnlock :\n    mayUnlock false = false := by\n  rfl'}
        </LeanCode>
        <div className={`verification-card ${broken ? 'is-broken' : 'is-safe'}`}>
          <span>{broken ? 'PROOF FAILED' : 'PROOF ACCEPTED'}</span>
          <strong>{broken ? '性質を保てません' : '書いた性質が保たれます'}</strong>
          <p>
            {broken
              ? '関数が常にtrueを返すため、鍵がない場合にも解錠します。既存の証明が実装変更を拒みます。'
              : 'falseを渡すとfalseが返ります。定理と実装が、Leanの計算規則の上で一致しています。'}
          </p>
        </div>
      </div>
    </div>
  )
}

const boundaryOptions = [
  {
    id: 'model',
    label: 'このLean上の関数は、鍵がfalseならfalseを返す',
    detail: '定理が直接述べ、証明している内容です。'
  },
  {
    id: 'sensor',
    label: '現実のセンサーは、鍵の有効性を常に正しく判定する',
    detail: 'センサーの挙動は、この定義にも定理にも含まれていません。'
  },
  {
    id: 'hardware',
    label: '錠前のハードウェアは、命令どおりに動作する',
    detail: '物理装置の故障や配線は、純粋な関数の証明だけでは扱えません。'
  },
  {
    id: 'security',
    label: 'システムには、ほかの脆弱性がひとつもない',
    detail: '定理に書いていない性質まで、自動的に保証されることはありません。'
  }
] as const

export function BoundaryExercise() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState(false)
  const isCorrect = selected.size === 1 && selected.has('model')

  function toggle(id: string) {
    setChecked(false)
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="boundary-exercise">
      <span className="lean-exercise__eyebrow">FINAL CHECK</span>
      <h3>この証明だけから保証できるものを、すべて選んでください。</h3>
      <div className="boundary-options">
        {boundaryOptions.map((option) => (
          <label key={option.id} className={selected.has(option.id) ? 'is-selected' : undefined}>
            <input
              type="checkbox"
              checked={selected.has(option.id)}
              onChange={() => toggle(option.id)}
            />
            <span>
              <strong>{option.label}</strong>
              {checked && <small>{option.detail}</small>}
            </span>
          </label>
        ))}
      </div>
      <div className="boundary-exercise__actions">
        <button type="button" disabled={selected.size === 0} onClick={() => setChecked(true)}>
          答えを確認する
        </button>
        {checked && (
          <p className={isCorrect ? 'is-correct' : 'is-wrong'} aria-live="polite">
            {isCorrect
              ? '正解です。証明は、形式化したモデルと命題の範囲で成立します。'
              : '選んだ項目の説明を確認してください。保証は、定理に書いた範囲を越えません。'}
          </p>
        )}
      </div>
    </div>
  )
}
