import { c as create_ssr_component, h as each, e as escape } from "../../../chunks/index2.js";
const _page_svelte_svelte_type_style_lang = "";
const css = {
  code: ".blogListWrap.svelte-9og2mj.svelte-9og2mj{display:flex;justify-content:center}.blogList.svelte-9og2mj.svelte-9og2mj{display:flex;flex-wrap:wrap;max-width:1100px;width:100%}.blogList.svelte-9og2mj a.svelte-9og2mj{width:100vw;overflow:hidden}.iconWrap.svelte-9og2mj.svelte-9og2mj{display:flex;justify-content:center;width:100%;border:0.2rem solid var(--sub-color);margin-top:3rem;border-radius:1rem;padding:4rem 0}.blogList.svelte-9og2mj a:first-child .iconWrap.svelte-9og2mj{margin-top:2rem}.icon.svelte-9og2mj.svelte-9og2mj{font-size:10rem;color:var(--key-color)}.text-gradient.svelte-9og2mj.svelte-9og2mj{font-weight:bold;text-align:center;background:#12c2e9;background:-webkit-linear-gradient(right, #12c2e9, #c471ed, #f64f59);background:linear-gradient(to right, #12c2e9, #c471ed, #f64f59);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}.title.svelte-9og2mj.svelte-9og2mj{font-size:1.8rem;font-weight:bold;margin-top:0.5rem;line-height:3rem}.date.svelte-9og2mj.svelte-9og2mj{font-size:1.4rem;margin-top:0.5rem;color:var(--sub-color)}@media(min-width: 480px){.blogList.svelte-9og2mj a:first-child .iconWrap.svelte-9og2mj{margin-top:3rem}.blogList.svelte-9og2mj a.svelte-9og2mj{width:33.3%;padding:0 0.5rem 0.5rem}}",
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
  return `<div class="${"blogListWrap svelte-9og2mj"}"><div class="${"blogList svelte-9og2mj"}">${each(data.list.items, ({ sys, fields }) => {
    return `${fields ? `<a href="${"/blog/" + escape(sys.id, true)}" class="${"svelte-9og2mj"}"><div class="${"iconWrap svelte-9og2mj"}"><span class="${"icon material-symbols-rounded text-gradient svelte-9og2mj"}">${escape(fields.icon ? fields.icon : "notes")}</span></div>
          <h1 class="${"title svelte-9og2mj"}">${escape(fields.text)}</h1>
          <p class="${"date svelte-9og2mj"}">${escape(getDateJa(fields.date))}</p>
        </a>` : ``}`;
  })}</div>
</div>`;
});
export {
  Page as default
};
