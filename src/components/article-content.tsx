import type { BlogPost } from '#/lib/blog-post'
import { authorName } from '#/lib/site'
import { ArticleSticker } from './article-sticker'
import { MarkdownBody } from './markdown-body'

export function ArticleContent({ post }: { post: BlogPost }) {
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
    </article>
  )
}
