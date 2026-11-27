import { parseBlogPosts, sortBlogPostsNewestFirst, toPublicBlogPost } from '#/lib/blog-post'

const blogSources = import.meta.glob<string>('/content/blog/*.md', {
  eager: true,
  import: 'default',
  query: '?raw'
})

function indexPosts() {
  const records = parseBlogPosts(
    Object.entries(blogSources).map(([path, source]) => ({ path: path.slice(1), source }))
  )
  const posts = sortBlogPostsNewestFirst(records.filter((post) => !post.draft)).map(
    toPublicBlogPost
  )
  return {
    posts,
    bySlug: new Map(posts.map((post) => [post.slug, post])),
    summaries: posts.map(({ body: _body, ...summary }) => summary)
  }
}

let index: ReturnType<typeof indexPosts>
function getIndex() {
  index ??= indexPosts()
  return index
}

export function loadHomeData() {
  return { posts: getIndex().summaries }
}

export function loadPostData(slug: string) {
  const post = getIndex().bySlug.get(slug)
  return post ? { post } : null
}

export function getBlogFeedPosts() {
  return getIndex().posts
}
