import * as server from '../entries/pages/blog/_slug_/_page.server.ts.js';

export const index = 4;
export const component = async () => (await import('../entries/pages/blog/_slug_/_page.svelte.js')).default;
export const file = '_app/immutable/entry/blog-_slug_-page.svelte.86b26013.js';
export { server };
export const server_id = "src/routes/blog/[slug]/+page.server.ts";
export const imports = ["_app/immutable/entry/blog-_slug_-page.svelte.86b26013.js","_app/immutable/chunks/index.207a4863.js","_app/immutable/chunks/paths.58b72908.js"];
export const stylesheets = ["_app/immutable/assets/_page.d05d31de.css"];
export const fonts = [];
