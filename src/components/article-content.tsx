import { Link } from '@tanstack/react-router'
import type { BlogPost, BlogPostSummary } from '#/lib/blog-post'
import { authorName } from '#/lib/site'
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
                  <time dateTime={related.date}>{related.date.replaceAll('-', '.')}</time>
                  <h3>{related.title}</h3>
                  <ul className="article-tags" aria-label="共通のタグ">
                    {related.tags
                      .filter((tag) => post.tags.includes(tag))
                      .map((tag) => (
                        <li key={tag}>#{tag}</li>
                      ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
