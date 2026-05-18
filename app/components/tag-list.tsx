import { FaHashtag } from 'react-icons/fa6'
import { tagPillClassName } from '~/lib/styles'

type TagListProps = {
  tags: string[]
}

export function TagList({ tags }: TagListProps) {
  if (tags.length === 0) {
    return null
  }

  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Tags">
      {tags.map((tag) => (
        <li className={tagPillClassName} key={tag}>
          <FaHashtag aria-hidden="true" />
          {tag}
        </li>
      ))}
    </ul>
  )
}
