import { type BlogPostSummary, sortBlogPostsNewestFirst } from './blog-post'

export function getRelatedPosts(post: BlogPostSummary, posts: BlogPostSummary[]) {
  const tags = new Set(post.tags)
  return sortBlogPostsNewestFirst(
    posts.filter(
      (candidate) => candidate.slug !== post.slug && candidate.tags.some((tag) => tags.has(tag))
    )
  ).slice(0, 3)
}
