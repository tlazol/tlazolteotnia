import type { Route } from "./+types/home";
import { Link } from "react-router";
import { FaAngleRight, FaHashtag } from "react-icons/fa6";
import { ProfileFooter } from "~/components/profile-footer";
import { getBlogPosts } from "~/lib/blog.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Tlazolteotnia | 0rga.org" },
    {
      name: "description",
      content:
        "Personal site and notes from Daisuke Kobayashi / Tlazolteotnia.",
    },
  ];
}

export async function loader() {
  const posts = await getBlogPosts();

  return { posts };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;

  return (
    <main className="site-shell">
      <section className="hero-section" aria-labelledby="site-title">
        <p className="terminal-label">ssh 0rga.org</p>
        <h1 id="site-title">Tlazolteotnia</h1>
        <p className="hero-copy" aria-hidden="true">
          <span>CHΔ0S://9X_QR⟊⟊⧖NULL::0x7F-VOID</span>
          <span>SYS∴C-AO5⟫⟫VANTA_404::λλ⟁ERR</span>
          <span>RX#CHA0S//Ω_808⟐⟐GL1TCH::NOISE</span>
        </p>
        <div className="hero-actions" aria-label="Primary links">
          <a href="https://www.artstation.com/orga">
            <FaAngleRight aria-hidden="true" />
            ArtStation
          </a>
        </div>
        <div className="hero-terminal">
          <div className="terminal-chrome">
            <span />
            <span />
            <span />
          </div>
          <pre>
            <code>{`Daisuke Kobayashi's personal terminal
for artwork, notes, and small dispatches
from the edge of the screen.`}</code>
          </pre>
        </div>
      </section>

      <section className="blog-section">
        <p className="terminal-label">ls content/blog</p>

        {posts.length > 0 ? (
          <ol className="post-list">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link className="post-card" to={`/blog/${post.slug}`}>
                  <span className="post-card__date">{formatDate(post.date)}</span>
                  <span className="post-card__body">
                    <span className="post-card__title">{post.title}</span>
                    <span className="post-card__description">
                      {post.description}
                    </span>
                    {post.tags.length > 0 && (
                      <span className="post-card__tags" aria-label="Tags">
                        {post.tags.map((tag) => (
                          <span className="tag-pill" key={tag}>
                            <FaHashtag aria-hidden="true" />
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">No public posts found.</p>
        )}
      </section>

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
