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
  'py-[30px] pb-2.5 text-base leading-[1.85] text-[var(--text)]',
  '[&>*]:max-w-[720px]',
  '[&_h2]:mt-[2em] [&_h2]:mb-[0.7em] [&_h2]:text-[var(--green-soft)] [&_h2]:leading-[1.2]',
  '[&_h3]:mt-[2em] [&_h3]:mb-[0.7em] [&_h3]:text-[var(--green-soft)] [&_h3]:leading-[1.2]',
  '[&_p]:mt-0 [&_p]:mb-[1.25em] [&_ul]:mt-0 [&_ul]:mb-[1.25em] [&_ol]:mt-0 [&_ol]:mb-[1.25em] [&_blockquote]:mt-0 [&_blockquote]:mb-[1.25em] [&_pre]:mt-0 [&_pre]:mb-[1.25em]',
  '[&_a]:font-bold [&_a]:text-[var(--green)] [&_a]:underline [&_a]:decoration-[rgba(49,255,128,0.45)] [&_a]:decoration-dashed [&_a]:decoration-1 [&_a]:underline-offset-[0.2em]',
  '[&_code]:border [&_code]:border-[var(--line)] [&_code]:bg-[var(--panel)] [&_code]:px-[0.35em] [&_code]:py-[0.1em] [&_code]:text-[0.92em] [&_code]:text-[var(--green-soft)]',
  '[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-[var(--line)] [&_pre]:bg-[var(--panel)] [&_pre]:p-4',
  '[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_blockquote]:border-l-[3px] [&_blockquote]:border-l-transparent [&_blockquote]:[border-image:var(--spectrum)_1] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--muted)]'
].join(' ')
