import { Link } from "react-router";
import { FaAngleRight, FaHashtag } from "react-icons/fa6";
import type { Route } from "./+types/blog.$slug";
import { ProfileFooter } from "~/components/profile-footer";
import { getBlogPost } from "~/lib/blog.server";

export async function loader({ params }: Route.LoaderArgs) {
  const post = await getBlogPost(params.slug);

  if (!post) {
    throw new Response("Not Found", { status: 404 });
  }

  return { post };
}

export function meta({ data }: Route.MetaArgs) {
  const post = data?.post;

  return [
    { title: post ? `${post.title} | Tlazolteotnia` : "Post not found" },
    {
      name: "description",
      content: post?.description ?? "A note from Tlazolteotnia.",
    },
  ];
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;

  return (
    <main className="site-shell">
      <article className="post-view">
        <Link className="back-link" to="/">
          <FaAngleRight aria-hidden="true" />
          cd ..
        </Link>

        <header className="post-header">
          <p className="terminal-label">cat content/blog/{post.slug}.md</p>
          <h1 className="!mt-16 !mb-12">{post.title}</h1>
          <div className="post-meta">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.tags.length > 0 && (
              <ul aria-label="Tags">
                {post.tags.map((tag) => (
                  <li className="tag-pill" key={tag}>
                    <FaHashtag aria-hidden="true" />
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p>{post.description}</p>
        </header>

        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </article>

      <ProfileFooter />
    </main>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}
