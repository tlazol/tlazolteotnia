import { e as error } from "../../../chunks/index.js";
import { s as skills } from "../../../chunks/skill.js";
const load = function load2() {
  try {
    return {
      skills: Object.entries(skills)
    };
  } catch (e) {
    throw error(404, "Not found");
  }
};
export {
  load
};
