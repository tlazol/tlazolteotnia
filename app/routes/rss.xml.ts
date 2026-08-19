import { createBlogFeedResponse } from '~/lib/blog-feed.server'

export function loader() {
  return createBlogFeedResponse('rss')
}
