export const bodyClassName = [
  'm-0 min-w-80 font-sans text-[var(--text)] selection:bg-[var(--green)] selection:text-[var(--bg)] [background:linear-gradient(118deg,rgba(45,172,249,0.13),transparent_28rem),linear-gradient(242deg,rgba(250,115,218,0.1),transparent_24rem),linear-gradient(180deg,#06100a_0%,var(--bg)_38rem)] [color-scheme:dark] [&_:focus-visible]:[outline:2px_solid_var(--green)] [&_:focus-visible]:[outline-offset:4px]',
  "before:pointer-events-none before:fixed before:inset-0 before:-z-10 before:bg-[linear-gradient(rgba(49,255,128,0.05)_1px,transparent_1px)] before:bg-[length:100%_4px] before:opacity-40 before:content-['']",
  "after:pointer-events-none after:fixed after:inset-0 after:-z-10 after:[background:linear-gradient(112deg,transparent_0_13%,rgba(45,172,249,0.1)_13%_13.2%,transparent_13.2%_30%,rgba(255,60,50,0.09)_30%_30.18%,transparent_30.18%_51%,rgba(250,115,218,0.1)_51%_51.2%,transparent_51.2%_69%,rgba(255,223,95,0.08)_69%_69.18%,transparent_69.18%),linear-gradient(180deg,rgba(49,255,128,0.06),transparent_34rem)] after:opacity-75 after:[mask-image:linear-gradient(180deg,#000_0%,transparent_74%)] after:content-['']"
].join(' ')

export const siteShellClassName =
  'relative mx-auto w-full max-w-[860px] px-[18px] pt-7 pb-11 min-[680px]:px-[30px] min-[680px]:pt-11 min-[680px]:pb-[60px]'

export const headingResetClassName = 'm-0 font-bold tracking-normal'

export const terminalLabelClassName =
  "m-0 mb-3.5 text-[0.78rem] font-bold leading-[1.4] text-[var(--green)] uppercase before:mr-[0.5ch] before:text-[var(--yellow)] before:content-['$']"

export const textLinkClassName = [
  'inline-flex max-w-full items-center gap-[0.28em] px-0 pt-0.5 pb-[5px] text-[0.9rem] leading-[1.35] font-bold text-[var(--green-soft)] underline decoration-[rgba(156,255,191,0.42)] decoration-dashed decoration-1 underline-offset-[0.28em] transition-[color,text-decoration-color,transform] duration-[160ms] ease-out [overflow-wrap:anywhere]',
  'hover:-translate-y-px hover:text-[var(--green)] hover:decoration-[rgba(49,255,128,0.9)] focus-visible:-translate-y-px focus-visible:text-[var(--green)] focus-visible:decoration-[rgba(49,255,128,0.9)]',
  '[&_svg]:size-[0.78em] [&_svg]:shrink-0 [&_svg]:text-[var(--green)]'
].join(' ')

export const tagPillClassName = [
  'inline-flex max-w-full items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--green)_28%,var(--line))] py-1 pr-[9px] pl-[7px] text-[0.75rem] leading-[1.35] font-bold text-[var(--green)] [background:linear-gradient(180deg,rgba(156,255,191,0.08),transparent),rgba(49,255,128,0.04)] [overflow-wrap:anywhere]',
  '[&_svg]:size-[0.72em] [&_svg]:shrink-0 [&_svg]:text-[var(--green-soft)]'
].join(' ')

export const markdownBodyClassName = [
  'markdown-body py-[30px] pb-2.5 text-base leading-[1.85] text-[var(--text)] [overflow-wrap:anywhere]',
  '[&>*]:max-w-[720px]',
  "[&_h2]:relative [&_h2]:mt-[3em] [&_h2]:mb-[1em] [&_h2]:pl-[2.1rem] [&_h2]:text-[clamp(1.35rem,4.8vw,1.9rem)] [&_h2]:leading-[1.32] [&_h2]:font-bold [&_h2]:text-[var(--green-soft)] [&_h2]:[overflow-wrap:anywhere] [&_h2]:[text-shadow:0_0_18px_rgba(49,255,128,0.22)] [&_h2]:before:absolute [&_h2]:before:top-0 [&_h2]:before:left-0 [&_h2]:before:text-[var(--yellow)] [&_h2]:before:content-['$'] [&_h2]:after:inline-block [&_h2]:after:ml-[0.35em] [&_h2]:after:h-[0.95em] [&_h2]:after:w-[0.42em] [&_h2]:after:translate-y-[0.13em] [&_h2]:after:bg-[var(--green)] [&_h2]:after:opacity-70 [&_h2]:after:content-['']",
  "[&_h3]:relative [&_h3]:mt-[2.25em] [&_h3]:mb-[0.8em] [&_h3]:pl-[1.45rem] [&_h3]:text-[clamp(1.1rem,3.6vw,1.32rem)] [&_h3]:leading-[1.42] [&_h3]:font-bold [&_h3]:text-[var(--cyan)] [&_h3]:[overflow-wrap:anywhere] [&_h3]:before:absolute [&_h3]:before:top-0 [&_h3]:before:left-0 [&_h3]:before:text-[var(--green)] [&_h3]:before:content-['>']",
  '[&_p]:mt-0 [&_p]:mb-[1.25em] [&_ul]:mt-0 [&_ul]:mb-[1.25em] [&_ol]:mt-0 [&_ol]:mb-[1.25em] [&_blockquote]:mt-0 [&_blockquote]:mb-[1.25em] [&_figure]:mt-0 [&_figure]:mb-[1.25em]',
  '[&_p:has(>img:only-child)]:max-w-full [&_p:has(>img:only-child)>img]:mx-auto [&_p:has(>img:only-child)>img]:block [&_p:has(>img:only-child)>img]:h-auto [&_p:has(>img:only-child)>img]:max-w-full',
  '[&_a]:font-bold [&_a]:text-[var(--green)] [&_a]:underline [&_a]:decoration-[rgba(49,255,128,0.45)] [&_a]:decoration-dashed [&_a]:decoration-1 [&_a]:underline-offset-[0.2em]',
  '[&_:not(pre)>code]:border [&_:not(pre)>code]:border-[var(--line)] [&_:not(pre)>code]:bg-[var(--panel)] [&_:not(pre)>code]:px-[0.35em] [&_:not(pre)>code]:py-[0.1em] [&_:not(pre)>code]:text-[0.92em] [&_:not(pre)>code]:text-[var(--green-soft)]',
  '[&_blockquote]:border-l-[3px] [&_blockquote]:border-l-transparent [&_blockquote]:[border-image:var(--spectrum)_1] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--muted)]'
].join(' ')

export const codeBlockClassName = [
  'max-w-full overflow-hidden border border-[color-mix(in_srgb,var(--line)_84%,var(--green)_16%)] bg-[linear-gradient(135deg,rgba(45,172,249,0.08),transparent_38%),linear-gradient(315deg,rgba(250,115,218,0.06),transparent_42%),rgba(4,12,8,0.94)]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_38px_rgba(0,0,0,0.25)]'
].join(' ')

export const codeBlockLabelClassName = [
  'border-b border-[color-mix(in_srgb,var(--line)_78%,var(--green)_22%)] px-4 py-2 text-[0.72rem] leading-[1.35] font-bold text-[var(--yellow)]',
  'bg-[linear-gradient(90deg,rgba(49,255,128,0.08),rgba(112,247,255,0.05),transparent)] [overflow-wrap:anywhere]'
].join(' ')

export const codeBlockPreClassName =
  'm-0 max-w-full overflow-x-auto bg-transparent px-4 py-[15px] text-[0.88rem] leading-[1.7] [tab-size:2]'

export const codeBlockLineClassName = 'block min-h-[1.7em] whitespace-pre'
