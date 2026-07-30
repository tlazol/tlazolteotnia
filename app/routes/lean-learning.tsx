import { Link } from 'react-router'
import { ProofPipeline } from '~/components/lean-learning-interactions'
import { LeanLearningShell } from '~/components/lean-learning-shell'
import { leanLessonHref, leanLessons, leanReferenceAudit } from '~/lib/lean-learning'

export function meta() {
  return [
    { title: 'Lean入門 | 証明をコードとして読む' },
    {
      name: 'description',
      content:
        'Leanを知らないプログラマー向けのインタラクティブ教材。型、命題、証明、プログラム検証、保証の境界を順に学びます。'
    }
  ]
}

export default function LeanLearningHome() {
  return (
    <LeanLearningShell>
      <section className="lean-hero">
        <div className="lean-hero__copy">
          <aside className="lean-personal-notice" aria-label="教材の位置づけ">
            <span>PERSONAL MATERIAL / 0rga</span>
            <p>
              あくまで、<strong>0rgaが自分の学習用に作っている個人教材</strong>
              です。Lean公式の教材ではありません。
            </p>
          </aside>
          <p className="lean-eyebrow">INTERACTIVE LEAN PRIMER</p>
          <h1>
            <span className="lean-hero__line lean-hero__line--plain">コードが正しい、</span>
            <span className="lean-hero__line">とはどういうことだろう。</span>
          </h1>
          <p className="lean-hero__lead">
            Leanは、依存型を持つ関数型プログラミング言語であり、対話型定理証明支援系です。
            値と関数から始め、帰納型、依存型、論理、帰納法、プログラム検証へ進みます。
            最後はTypeScriptとの境界と、証明が保証しない範囲まで読み解きます。
          </p>
          <div className="lean-hero__actions">
            <Link className="lean-button lean-button--primary" to={leanLessonHref('what-is-lean')}>
              最初から始める
              <span aria-hidden="true">→</span>
            </Link>
            <a className="lean-button lean-button--quiet" href="#curriculum">
              {leanLessons.length}のレッスンを見る
            </a>
          </div>
          <p className="lean-hero__note">
            入口はブラウザだけで読めます。各章には公式リファレンスへの導線があります。
          </p>
        </div>
        <ProofPipeline />
      </section>

      <section className="lean-thesis" aria-label="この教材の中心となる考え">
        <span>この教材で区別すること</span>
        <p>
          Leanが証明するのは、<strong>書かれた命題</strong>です。
          書かなかった性質や、現実の装置まで自動的に正しくなるわけではありません。
        </p>
      </section>

      <section className="lean-scope" aria-labelledby="lean-scope-title">
        <div className="lean-scope__heading">
          <p className="lean-eyebrow">SCOPE &amp; FRESHNESS</p>
          <h2 id="lean-scope-title">入門の範囲と公式資料への道筋</h2>
          <p>
            公式リファレンスはLeanを網羅的かつ厳密に調べるための資料であり、初心者向けのチュートリアルではありません。
            この教材は、プログラマーが定義と証明を読めるようになるまでの導入に範囲を絞っています。
          </p>
          <p className="lean-scope__audit">
            <span>検証基準</span>
            <a href={leanReferenceAudit.href}>
              Lean Language Reference {leanReferenceAudit.version}
              <span aria-hidden="true">↗</span>
            </a>
            <time dateTime={leanReferenceAudit.checkedAt}>
              {leanReferenceAudit.checkedAtLabel}確認
            </time>
          </p>
        </div>
        <div className="lean-scope__grid">
          <article>
            <span>この教材で扱う</span>
            <h3>コア言語と証明の読み方</h3>
            <p>
              型、関数、帰納型、依存型、命題、基本タクティク、帰納法、簡約、検証と信頼境界を順に扱います。
            </p>
          </article>
          <article>
            <span>公式資料へ進む</span>
            <h3>実プロジェクトで必要になる領域</h3>
            <p>
              モジュールと名前空間、IOとモナド、マクロとメタプログラミング、高度な自動化、mathlibは対象外です。
              本格的な開発では、各章の公式リンクと目的別の公式チュートリアルを併用してください。
            </p>
          </article>
        </div>
      </section>

      <section className="curriculum" id="curriculum">
        <div className="curriculum__heading">
          <p className="lean-eyebrow">CURRICULUM</p>
          <h2>核となる型理論から、実務の境界まで進む</h2>
          <p>
            短い操作だけを覚える教材ではありません。
            コードの各行が何を表し、カーネルが何を確認するかを段階的に読みます。
          </p>
        </div>
        <ol className="curriculum-list">
          {leanLessons.map((lesson) => (
            <li key={lesson.slug}>
              <Link to={leanLessonHref(lesson.slug)}>
                <span className="curriculum-list__number">
                  {String(lesson.number).padStart(2, '0')}
                </span>
                <span className="curriculum-list__copy">
                  <strong>{lesson.title}</strong>
                  <small>{lesson.summary}</small>
                </span>
                <span className="curriculum-list__arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="lean-principles">
        <article>
          <span>読む</span>
          <h2>数式より先に、コードから始める</h2>
          <p>Boolや関数など、プログラマーに馴染みのある材料から命題へ進みます。</p>
        </article>
        <article>
          <span>動かす</span>
          <h2>証明状態の変化を見る</h2>
          <p>操作のたびに、仮定とゴールがどう変わるかを同じ画面で確認します。</p>
        </article>
        <article>
          <span>疑う</span>
          <h2>保証の条件を確認する</h2>
          <p>証明が通った後にも残る、仕様と外部世界の問題を切り分けます。</p>
        </article>
      </section>
    </LeanLearningShell>
  )
}
