import { e as error } from "../../../../chunks/index.js";
import contentful from "contentful";
import markdownit from "markdown-it";
import { b as private_env } from "../../../../chunks/shared-server.js";
const md = new markdownit();
const load = async function({ params }) {
  try {
    const { slug } = params;
    if (slug && private_env.CONTENTFUL_ACCESS_TOKEN) {
      const client = contentful.createClient({
        space: private_env.CONTENTFUL_SPACE,
        accessToken: private_env.CONTENTFUL_ACCESS_TOKEN
      });
      const blogEntry = await client.getEntry(slug);
      const description = blogEntry.fields.markdown.substring(0, 120);
      blogEntry.fields.markdown = md.render(blogEntry.fields.markdown);
      const meta = {
        title: blogEntry.fields.text,
        description,
        img: `https://us-central1-tlazolteotnia.cloudfunctions.net/getThumbnail?text=${encodeURI(
          blogEntry.fields.text
        )}`,
        url: `https://0rga.org/blog/${slug}`
      };
      return {
        blogEntry,
        description,
        meta
      };
    }
    throw error(404, "Not found");
  } catch (e) {
    throw error(404, "Not found");
  }
};
export {
  load
};
