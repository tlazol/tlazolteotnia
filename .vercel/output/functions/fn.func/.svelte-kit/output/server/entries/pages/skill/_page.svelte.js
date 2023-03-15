import { c as create_ssr_component, h as each, f as add_attribute } from "../../../chunks/index2.js";
const _page_svelte_svelte_type_style_lang = "";
const css = {
  code: ".skillListWrap.svelte-l30rtq.svelte-l30rtq{display:flex;justify-content:center}.skillList.svelte-l30rtq.svelte-l30rtq{display:flex;flex-wrap:wrap;max-width:1100px;width:100%}.skillList.svelte-l30rtq .skill.svelte-l30rtq:first-child{margin-top:2rem}.skill.svelte-l30rtq.svelte-l30rtq{width:100%;aspect-ratio:16 / 9}.skill.svelte-l30rtq img.svelte-l30rtq{opacity:0;transition:all 0.5s ease}@media(min-width: 480px){.skillList.svelte-l30rtq.svelte-l30rtq{flex-wrap:nowrap;height:100vh}.skillList.svelte-l30rtq .skill.svelte-l30rtq:first-child{margin-top:0}.skill.svelte-l30rtq.svelte-l30rtq{overflow:hidden}a.svelte-l30rtq.svelte-l30rtq{display:flex;justify-content:center}picture.svelte-l30rtq.svelte-l30rtq{display:flex;justify-content:center;align-items:center}img.svelte-l30rtq.svelte-l30rtq{max-width:none;max-height:100vh}}",
  map: null
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { data } = $$props;
  if ($$props.data === void 0 && $$bindings.data && data !== void 0)
    $$bindings.data(data);
  $$result.css.add(css);
  return `<div class="${"skillListWrap svelte-l30rtq"}"><div class="${"skillList svelte-l30rtq"}">${each(data.skills, ([k, v]) => {
    return `<div class="${"skill svelte-l30rtq"}"><a${add_attribute("href", `/skill/${v.shortId}`, 0)} class="${"svelte-l30rtq"}"><picture class="${"svelte-l30rtq"}"><source${add_attribute("srcset", `/img/material/${v.id}.webp`, 0)} type="${"image/webp"}">
            <img${add_attribute("alt", v.name[data.lang], 0)} loading="${"lazy"}" class="${"svelte-l30rtq"}">
          </picture></a>
      </div>`;
  })}</div>
</div>`;
});
export {
  Page as default
};
