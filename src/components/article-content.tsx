import { Link } from '@tanstack/react-router'
import type { BlogPost, BlogPostSummary } from '#/lib/blog-post'
import { authorName, getBlogPostOgImagePath } from '#/lib/site'
import { ArticleSticker } from './article-sticker'
import { MarkdownBody } from './markdown-body'

export function ArticleContent({
  post,
  relatedPosts = []
}: {
  post: BlogPost
  relatedPosts?: BlogPostSummary[]
}) {
  return (
    <article>
      <header className="article-heading">
        <ArticleSticker post={post} />
        <p className="article-byline">
          <time dateTime={post.date}>{post.date.replaceAll('-', '.')}</time>
          <span>{authorName}</span>
        </p>
        <p className="article-description">{post.description}</p>
        <ul className="article-tags" aria-label="タグ">
          {post.tags.map((tag) => (
            <li key={tag}>#{tag}</li>
          ))}
        </ul>
      </header>
      <MarkdownBody body={post.body} />
      {relatedPosts.length > 0 && (
        <section className="related-posts" aria-labelledby="related-posts-heading">
          <h2 id="related-posts-heading">あわせて読みたい</h2>
          <ul className="related-posts__list">
            {relatedPosts.map((related) => (
              <li key={related.slug}>
                <Link to="/blog/$slug" params={{ slug: related.slug }} preload={false}>
                  <img
                    className="related-posts__image"
                    src={getBlogPostOgImagePath(related.slug)}
                    alt={related.title}
                    width={1200}
                    height={630}
                    loading="lazy"
                    decoding="async"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
