import { getBlogPost, getBlogPosts } from '#/lib/blog.server'

export async function loadHomeData() {
  return { posts: await getBlogPosts() }
}

export async function loadPostData(slug: string) {
  const post = await getBlogPost(slug)
  return post ? { post } : null
}
