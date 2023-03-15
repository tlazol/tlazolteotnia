import { e as error } from "../../../chunks/index.js";
import contentful from "contentful";
import { b as private_env } from "../../../chunks/shared-server.js";
const load = async function() {
  try {
    if (private_env.CONTENTFUL_ACCESS_TOKEN) {
      const client = contentful.createClient({
        space: private_env.CONTENTFUL_SPACE,
        accessToken: private_env.CONTENTFUL_ACCESS_TOKEN
      });
      const list = await client.getEntries({
        order: "-sys.createdAt",
        content_type: "blog"
      });
      return {
        list
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
