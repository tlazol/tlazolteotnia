export type TagFilter = {
  name: string
  count: number
}

type TaggedPost = {
  tags: string[]
}

const tagFilterMinimumCount = 3

export function getTagFilters(posts: TaggedPost[]): TagFilter[] {
  const tagCounts = new Map<string, number>()

  for (const post of posts) {
    for (const tag of post.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(tagCounts, ([name, count]) => ({ name, count }))
    .filter((tag) => tag.count >= tagFilterMinimumCount)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
}
