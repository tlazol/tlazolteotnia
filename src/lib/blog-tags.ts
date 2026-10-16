import type { BlogPostSummary } from './blog-post'

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

export function filterPostsByTag<Post extends TaggedPost>(posts: Post[], selectedTag: string) {
  return selectedTag ? posts.filter((post) => post.tags.includes(selectedTag)) : posts
}

export function filterBlogPosts(posts: BlogPostSummary[], topic: string, query: string) {
  const terms = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return posts.filter((post) => {
    const text = [post.title, post.description, ...post.tags]
      .join(' ')
      .normalize('NFKC')
      .toLocaleLowerCase()
    return (!topic || post.tags.includes(topic)) && terms.every((term) => text.includes(term))
  })
}
