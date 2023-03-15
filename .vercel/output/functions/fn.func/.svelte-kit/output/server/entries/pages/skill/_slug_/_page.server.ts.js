import { e as error } from "../../../../chunks/index.js";
import { s as skills } from "../../../../chunks/skill.js";
const load = async function({ params }) {
  try {
    const { slug } = params;
    if (slug && skills[slug]) {
      const data = skills[slug];
      return {
        id: slug,
        skill: data
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
