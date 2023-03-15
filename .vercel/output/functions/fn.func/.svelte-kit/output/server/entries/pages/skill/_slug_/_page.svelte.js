import { c as create_ssr_component, f as add_attribute, i as is_promise, n as noop, e as escape } from "../../../../chunks/index2.js";
const _page_svelte_svelte_type_style_lang = "";
const css = {
  code: ".skillWrap.svelte-1rostk8.svelte-1rostk8{display:flex;justify-content:center}.skill.svelte-1rostk8.svelte-1rostk8{max-width:1100px;width:100%;margin-top:2rem}.hero.svelte-1rostk8.svelte-1rostk8{width:100%;aspect-ratio:16 / 9}.clapWrap.svelte-1rostk8.svelte-1rostk8{display:flex;justify-content:center;margin-top:3rem}.clapWrap.svelte-1rostk8 .clapColumn.svelte-1rostk8{flex:1;justify-content:center;display:flex;align-items:center}.clapWrap.svelte-1rostk8 span.svelte-1rostk8{font-size:3rem;width:3rem;overflow:hidden}.clapWrap.svelte-1rostk8 span.anime.svelte-1rostk8{animation:purun 1s linear infinite}.clapWrap.svelte-1rostk8 .center.svelte-1rostk8{border-left:1px solid var(--sub-color-3);border-right:1px solid var(--sub-color-3);font-size:1.5rem}.clapWrap.svelte-1rostk8 .clapNum.svelte-1rostk8{font-size:1.5rem;margin-left:1rem;min-width:5rem}h1.svelte-1rostk8.svelte-1rostk8{font-weight:bold;font-size:3rem;text-align:center;margin-top:3rem}img.svelte-1rostk8.svelte-1rostk8{opacity:0;transition:all 0.5s ease}.description.svelte-1rostk8.svelte-1rostk8{margin-top:3rem;line-height:3.2rem;font-size:1.6rem}.buttonText.svelte-1rostk8.svelte-1rostk8{font-size:1.4rem;text-align:center;margin-top:3rem}a.svelte-1rostk8.svelte-1rostk8{display:block;text-align:center;text-decoration:underline}.text-gradient.svelte-1rostk8.svelte-1rostk8{font-weight:bold;text-align:center;background:#12c2e9;background:-webkit-linear-gradient(right, #12c2e9, #c471ed, #f64f59);background:linear-gradient(to right, #12c2e9, #c471ed, #f64f59);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-size:8rem;border-bottom:3px solid var(--a-color);border-radius:0.5rem;width:8rem;overflow:hidden}@media(min-width: 480px){.skill.svelte-1rostk8.svelte-1rostk8{margin-top:0}h1.svelte-1rostk8.svelte-1rostk8{font-size:10rem}.text-gradient.svelte-1rostk8.svelte-1rostk8{font-size:12rem;width:12rem}}",
  map: null
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { data } = $$props;
  let clapNum = 0;
  const getClap = async () => {
  };
  if ($$props.data === void 0 && $$bindings.data && data !== void 0)
    $$bindings.data(data);
  $$result.css.add(css);
  return `<div class="${"skillWrap svelte-1rostk8"}"><div class="${"skill svelte-1rostk8"}"><div class="${"hero svelte-1rostk8"}"><picture><source${add_attribute("srcset", `/img/material/${data.skill.id}.webp`, 0)} type="${"image/webp"}">
        <img${add_attribute("alt", data.skill.name[data.lang], 0)} loading="${"lazy"}" class="${"svelte-1rostk8"}"></picture></div>
    <div class="${"clapWrap svelte-1rostk8"}">
      <div class="${"clapColumn svelte-1rostk8"}"><span class="${"material-symbols-rounded anime svelte-1rostk8"}">thumb_up </span>
        ${function(__value) {
    if (is_promise(__value)) {
      __value.then(null, noop);
      return `
          <p class="${"clapNum svelte-1rostk8"}">.....</p>
        `;
    }
    return function(data2) {
      return `
          <p class="${"clapNum svelte-1rostk8"}">${escape(clapNum)}</p>
        `;
    }();
  }(getClap())}</div>
      <p class="${"clapColumn center svelte-1rostk8"}">Play for free</p>
      <span class="${"clapColumn material-symbols-rounded svelte-1rostk8"}">nest_mini </span></div>
    <h1 class="${"svelte-1rostk8"}">${escape(data.skill.name[data.lang])}</h1>
    ${data.lang === "en-US" && !data.skill.en ? `<p class="${"buttonText svelte-1rostk8"}">\\ ${escape(data.skill.description[data.lang])} /</p>
      <a target="${"_blank"}" rel="${"noopener noreferrer"}"${add_attribute("href", `${data.skill.aogUrl}?hl=ja-JP`, 0)} class="${"svelte-1rostk8"}"><span class="${"material-symbols-rounded text-gradient svelte-1rostk8"}">stadia_controller </span></a>` : `<p class="${"buttonText svelte-1rostk8"}">\\ GAME START /</p>
      <a target="${"_blank"}" rel="${"noopener noreferrer"}"${add_attribute("href", `${data.skill.aogUrl}?hl=${data.lang}`, 0)} class="${"svelte-1rostk8"}"><span class="${"material-symbols-rounded text-gradient svelte-1rostk8"}">stadia_controller </span></a>
      <p class="${"description svelte-1rostk8"}">${escape(data.skill.description[data.lang])}</p>`}</div>
</div>`;
});
export {
  Page as default
};
