import { c as create_ssr_component, e as escape } from "../../../../chunks/index2.js";
const prism = "";
const _page_svelte_svelte_type_style_lang = "";
const css = {
  code: ".wrap.svelte-17lm192{display:flex;justify-content:center}#blogWrap.svelte-17lm192{max-width:1100px;width:100%}.title.svelte-17lm192{font-size:5rem;line-height:6rem;font-weight:bold;margin-top:2rem}.date.svelte-17lm192{font-size:1.4rem;margin-top:1rem;margin-bottom:2rem;color:var(--sub-color)}@media(min-width: 480px){.title.svelte-17lm192{font-size:8rem;line-height:10rem;margin-top:5rem}}",
  map: null
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { data } = $$props;
  const getDateJa = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString();
  };
  if ($$props.data === void 0 && $$bindings.data && data !== void 0)
    $$bindings.data(data);
  $$result.css.add(css);
  return `${``}

<div class="${"wrap svelte-17lm192"}"><div id="${"blogWrap"}" class="${"svelte-17lm192"}"><div class="${"title svelte-17lm192"}">${escape(data.blogEntry.fields.text)}</div>
    <div class="${"date svelte-17lm192"}">${escape(getDateJa(data.blogEntry.fields.date))}</div>
    <!-- HTML_TAG_START -->${data.blogEntry.fields.markdown}<!-- HTML_TAG_END --></div>
</div>`;
});
export {
  Page as default
};
