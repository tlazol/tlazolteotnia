import acceptLanguageParser from "accept-language-parser";
const handle = async function({ event, resolve }) {
  const acceptLanguage = event.request.headers.get("accept-language");
  const languages = ["ja-JP", "en-US"];
  const detectedLang = acceptLanguageParser.pick(languages, acceptLanguage ?? "en-US");
  event.locals.lang = detectedLang ? detectedLang : "en-US";
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", detectedLang ?? "en-US")
  });
};
export {
  handle
};
