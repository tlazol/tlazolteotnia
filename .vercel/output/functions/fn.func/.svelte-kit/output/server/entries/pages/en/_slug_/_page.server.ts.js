import { r as redirect, e as error } from "../../../../chunks/index.js";
import { s as skills } from "../../../../chunks/skill.js";
const load = async function({ params }) {
  const { slug } = params;
  if (slug && skills[slug]) {
    throw redirect(301, `/skill/${slug}`);
  }
  throw error(404, "Not found");
};
export {
  load
};
