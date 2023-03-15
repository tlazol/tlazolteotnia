import { c as create_ssr_component, b as subscribe, e as escape, d as null_to_empty, f as add_attribute, v as validate_component } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
const Header_svelte_svelte_type_style_lang = "";
const css$1 = {
  code: "header.svelte-1i1s1de{position:sticky;bottom:0;display:flex;justify-content:center;width:100vw;background-color:var(--main-background);border-top:1px solid var(--sub-color-3)}nav.svelte-1i1s1de{width:100vw;max-width:800px}ul.svelte-1i1s1de{display:flex}li.svelte-1i1s1de{flex:1;justify-content:center;display:flex;padding:1rem 0}a.svelte-1i1s1de{display:flex}.on.svelte-1i1s1de{color:var(--key-color);font-weight:bold;text-decoration:underline}.material-symbols-rounded.svelte-1i1s1de{font-size:2.5rem;padding:1rem;width:4.5rem;overflow:hidden}",
  map: null
};
const Header = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $page, $$unsubscribe_page;
  $$unsubscribe_page = subscribe(page, (value) => $page = value);
  $$result.css.add(css$1);
  $$unsubscribe_page();
  return `<header class="${"svelte-1i1s1de"}"><nav class="${"svelte-1i1s1de"}"><ul class="${"svelte-1i1s1de"}"><li class="${"svelte-1i1s1de"}"><a href="${"/"}" class="${escape(null_to_empty($page.url.pathname === "/" ? "on" : void 0), true) + " svelte-1i1s1de"}"><span class="${"material-symbols-rounded svelte-1i1s1de"}">house </span></a></li>
      <li class="${"svelte-1i1s1de"}"><a href="${"/gallery"}" class="${escape(null_to_empty($page.url.pathname === "/gallery" ? "on" : void 0), true) + " svelte-1i1s1de"}"><span class="${"material-symbols-rounded svelte-1i1s1de"}">photo_library </span></a></li>
      <li class="${"svelte-1i1s1de"}"><a href="${"/skill"}" class="${escape(
    null_to_empty($page.url.pathname.startsWith("/skill") ? "on" : void 0),
    true
  ) + " svelte-1i1s1de"}"><span class="${"material-symbols-rounded svelte-1i1s1de"}">stadia_controller </span></a></li>
      <li class="${"svelte-1i1s1de"}"><a href="${"/blog"}" class="${escape(
    null_to_empty($page.url.pathname.startsWith("/blog") ? "on" : void 0),
    true
  ) + " svelte-1i1s1de"}"><span class="${"material-symbols-rounded svelte-1i1s1de"}">description </span></a></li></ul></nav>
</header>`;
});
const styles = "";
const _layout_svelte_svelte_type_style_lang = "";
const css = {
  code: ".app.svelte-xtm6xn.svelte-xtm6xn{display:flex;flex-direction:column;min-height:100vh}main.svelte-xtm6xn.svelte-xtm6xn{flex:1;display:flex;flex-direction:column;padding:0 2rem;width:100%;margin:0 auto}footer.svelte-xtm6xn.svelte-xtm6xn{display:flex;justify-content:center;padding:0 2rem;margin-top:12rem;margin-bottom:6rem}footer.svelte-xtm6xn .iconBox.svelte-xtm6xn{display:flex;flex-wrap:wrap;max-width:1100px;width:100%}footer.svelte-xtm6xn .iconWrap.svelte-xtm6xn{display:flex;margin:1rem 0;width:100%}footer.svelte-xtm6xn p.svelte-xtm6xn{font-size:1.4rem;align-items:center;display:flex;color:var(--sub-color)}footer.svelte-xtm6xn a.svelte-xtm6xn{font-size:1.4rem;align-items:center;display:flex;color:var(--blog-a-clor);text-decoration:underline;font-weight:bold}footer.svelte-xtm6xn .icon.svelte-xtm6xn{padding-right:0.5rem;font-size:2rem;color:var(--sub-color);overflow:hidden;width:3rem}@media(min-width: 480px){footer.svelte-xtm6xn.svelte-xtm6xn{padding:1rem 0}footer.svelte-xtm6xn .iconWrap.svelte-xtm6xn{justify-content:center}}",
  map: null
};
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $page, $$unsubscribe_page;
  $$unsubscribe_page = subscribe(page, (value) => $page = value);
  let { data } = $$props;
  if ($$props.data === void 0 && $$bindings.data && data !== void 0)
    $$bindings.data(data);
  $$result.css.add(css);
  $$unsubscribe_page();
  return `${$$result.head += `<!-- HEAD_svelte-uewqnk_START -->${data.meta ? `${$$result.title = `<title>${escape($page.data.meta.title ? $page.data.meta.title : data.meta.title)}</title>`, ""}
    <meta property="${"og:title"}"${add_attribute(
    "content",
    $page.data.meta.title ? $page.data.meta.title : data.meta.title,
    0
  )}>
    <meta name="${"twitter:title"}"${add_attribute(
    "content",
    $page.data.meta.title ? $page.data.meta.title : data.meta.title,
    0
  )}>
    <meta itemprop="${"name"}"${add_attribute(
    "content",
    $page.data.meta.title ? $page.data.meta.title : data.meta.title,
    0
  )}>
    <meta name="${"description"}"${add_attribute(
    "content",
    $page.data.meta.description ? $page.data.meta.description : data.meta.description,
    0
  )}>
    <meta itemprop="${"description"}"${add_attribute(
    "content",
    $page.data.meta.description ? $page.data.meta.description : data.meta.description,
    0
  )}>
    <meta property="${"og:description"}"${add_attribute(
    "content",
    $page.data.meta.description ? $page.data.meta.description : data.meta.description,
    0
  )}>
    <meta name="${"twitter:description"}"${add_attribute(
    "content",
    $page.data.meta.description ? $page.data.meta.description : data.meta.description,
    0
  )}>
    <meta property="${"og:image"}"${add_attribute(
    "content",
    $page.data.meta.img ? $page.data.meta.img : data.meta.img,
    0
  )}>
    <meta itemprop="${"image"}"${add_attribute(
    "content",
    $page.data.meta.img ? $page.data.meta.img : data.meta.img,
    0
  )}>
    <meta name="${"twitter:image"}"${add_attribute(
    "content",
    $page.data.meta.img ? $page.data.meta.img : data.meta.img,
    0
  )}>
    <meta property="${"og:url"}"${add_attribute(
    "content",
    $page.data.meta.url ? $page.data.meta.url : data.meta.url,
    0
  )}>
    <meta name="${"twitter:url"}"${add_attribute(
    "content",
    $page.data.meta.url ? $page.data.meta.url : data.meta.url,
    0
  )}>` : ``}<!-- HEAD_svelte-uewqnk_END -->`, ""}

<div class="${"app svelte-xtm6xn"}"><main class="${"svelte-xtm6xn"}">${slots.default ? slots.default({}) : ``}</main>

  <footer class="${"svelte-xtm6xn"}"><div class="${"iconBox svelte-xtm6xn"}"><div class="${"iconWrap svelte-xtm6xn"}"><span class="${"icon material-symbols-rounded svelte-xtm6xn"}">account_circle </span>
        <p class="${"svelte-xtm6xn"}">Daisuke Kobayashi</p></div>
      <div class="${"iconWrap svelte-xtm6xn"}"><span class="${"icon material-symbols-rounded svelte-xtm6xn"}">alternate_email </span>
        <p class="${"svelte-xtm6xn"}">d.covayashi@gmail.com</p></div>
      <div class="${"iconWrap svelte-xtm6xn"}"><span class="${"icon material-symbols-rounded svelte-xtm6xn"}">outbound </span>
        <p class="${"svelte-xtm6xn"}"><a class="${"twitter svelte-xtm6xn"}" href="${"https://twitter.com/0rga"}" target="${"_blank"}" rel="${"noopener noreferrer"}">Twitter</a></p></div>
      <div class="${"iconWrap svelte-xtm6xn"}"><span class="${"icon material-symbols-rounded svelte-xtm6xn"}">copyright </span>
        <p class="${"svelte-xtm6xn"}">Tlazolteotnia</p></div></div></footer>

  ${validate_component(Header, "Header").$$render($$result, {}, {}, {})}
</div>`;
});
export {
  Layout as default
};
