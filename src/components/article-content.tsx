import { Link } from '@tanstack/react-router'
import type { BlogPost } from '#/lib/blog-post'
import { shouldOpenPostModal } from '#/lib/post-modal'
import type { ReactionCount } from '#/lib/reactions'
import { authorName } from '#/lib/site'
import { ArticleReactionFooter } from './article-reaction-footer'
import { ArticleSticker } from './article-sticker'
import { MarkdownBody } from './markdown-body'

export function ArticleContent({
  post,
  reactions,
  onTagNavigate
}: {
  post: BlogPost
  reactions: ReactionCount[]
  onTagNavigate?: () => void
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
            <li key={tag}>
              <Link
                to="/"
                search={{ topic: tag }}
                onClick={(event) => {
                  if (shouldOpenPostModal(event)) onTagNavigate?.()
                }}
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      </header>
      <MarkdownBody body={post.body} />
      <ArticleReactionFooter reactions={reactions} slug={post.slug} />
    </article>
  )
}
