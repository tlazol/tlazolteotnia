import type { ReactNode } from 'react'
import { FaAngleRight } from 'react-icons/fa6'
import { Link } from 'react-router'
import { textLinkClassName } from '~/lib/styles'

type BackLinkProps = {
  children?: ReactNode
  to?: string
}

export function BackLink({ children = 'cd ..', to = '/' }: BackLinkProps) {
  return (
    <Link className={`${textLinkClassName} mb-[34px] text-[0.82rem] !text-[var(--green)]`} to={to}>
      <FaAngleRight aria-hidden="true" />
      {children}
    </Link>
  )
}
