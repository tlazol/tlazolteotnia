export const manifest = {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([".DS_Store","favicon.png","img/.DS_Store","img/gallery/1.jpg","img/gallery/10.jpg","img/gallery/12.jpg","img/gallery/14.jpg","img/gallery/15.jpg","img/gallery/16.jpg","img/gallery/17.jpg","img/gallery/19.jpg","img/gallery/2.jpg","img/gallery/20.jpg","img/gallery/21.jpg","img/gallery/22.jpg","img/gallery/23.jpg","img/gallery/24.jpg","img/gallery/25.jpg","img/gallery/26.jpg","img/gallery/27.jpg","img/gallery/28.jpg","img/gallery/29.jpg","img/gallery/3.jpg","img/gallery/32.jpg","img/gallery/33.jpg","img/gallery/34.jpg","img/gallery/35.jpg","img/gallery/36.jpg","img/gallery/37.jpg","img/gallery/38.jpg","img/gallery/39.jpg","img/gallery/4.jpg","img/gallery/40.jpg","img/gallery/41.jpg","img/gallery/42.jpg","img/gallery/43.jpg","img/gallery/44.jpg","img/gallery/45.jpg","img/gallery/46.jpg","img/gallery/47.jpg","img/gallery/48.jpg","img/gallery/49.jpg","img/gallery/5.jpg","img/gallery/50.jpg","img/gallery/51.jpg","img/gallery/52.jpg","img/gallery/53.jpg","img/gallery/54.jpg","img/gallery/55.jpg","img/gallery/6.jpg","img/gallery/7.jpg","img/gallery/8.jpg","img/gallery/9.jpg","img/gallery/_1.jpg","img/gallery/_10.jpg","img/gallery/_11.jpg","img/gallery/_12.jpg","img/gallery/_13.jpg","img/gallery/_14.jpg","img/gallery/_15.jpg","img/gallery/_16.jpg","img/gallery/_17.jpg","img/gallery/_18.jpg","img/gallery/_19.jpg","img/gallery/_2.jpg","img/gallery/_20.jpg","img/gallery/_21.jpg","img/gallery/_22.jpg","img/gallery/_23.jpg","img/gallery/_24.jpg","img/gallery/_25.jpg","img/gallery/_26.jpg","img/gallery/_27.jpg","img/gallery/_28.jpg","img/gallery/_29.jpg","img/gallery/_3.jpg","img/gallery/_30.jpg","img/gallery/_31.jpg","img/gallery/_32.jpg","img/gallery/_33.jpg","img/gallery/_34.jpg","img/gallery/_35.jpg","img/gallery/_36.jpg","img/gallery/_37.jpg","img/gallery/_38.jpg","img/gallery/_4.jpg","img/gallery/_5.jpg","img/gallery/_6.jpg","img/gallery/_7.jpg","img/gallery/_8.jpg","img/gallery/_9.jpg","img/material/.DS_Store","img/material/battleMachine.icon.png","img/material/battleMachine.jpg","img/material/battleMachine.webp","img/material/demonsDungeon.icon.png","img/material/demonsDungeon.jpg","img/material/demonsDungeon.webp","img/material/dwarfMine.icon.png","img/material/dwarfMine.jpg","img/material/dwarfMine.webp","img/material/heroOfDungeon.icon.png","img/material/heroOfDungeon.jpg","img/material/heroOfDungeon.webp","img/material/twitter.png","img/nft/1.png","img/nft/10.png","img/nft/2.png","img/nft/3.png","img/nft/4.png","img/nft/5.png","img/nft/6.png","img/nft/7.png","img/nft/8.png","img/nft/9.png","prism.js","static/parts-img/skills-en.jpg","static/parts-img/skills.jpg"]),
	mimeTypes: {".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".js":"application/javascript"},
	_: {
		client: {"start":{"file":"_app/immutable/entry/start.fc3dac11.js","imports":["_app/immutable/entry/start.fc3dac11.js","_app/immutable/chunks/index.207a4863.js","_app/immutable/chunks/singletons.3317e66e.js","_app/immutable/chunks/paths.58b72908.js"],"stylesheets":[],"fonts":[]},"app":{"file":"_app/immutable/entry/app.d66b49f4.js","imports":["_app/immutable/entry/app.d66b49f4.js","_app/immutable/chunks/index.207a4863.js"],"stylesheets":[],"fonts":[]}},
		nodes: [
			() => import('../output/server/nodes/0.js'),
			() => import('../output/server/nodes/1.js'),
			() => import('../output/server/nodes/2.js'),
			() => import('../output/server/nodes/3.js'),
			() => import('../output/server/nodes/4.js'),
			() => import('../output/server/nodes/5.js'),
			() => import('../output/server/nodes/6.js'),
			() => import('../output/server/nodes/7.js'),
			() => import('../output/server/nodes/8.js'),
			() => import('../output/server/nodes/9.js')
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0], errors: [1], leaf: 2 },
				endpoint: null
			},
			{
				id: "/blog",
				pattern: /^\/blog\/?$/,
				params: [],
				page: { layouts: [0], errors: [1], leaf: 3 },
				endpoint: null
			},
			{
				id: "/blog/[slug]",
				pattern: /^\/blog\/([^/]+?)\/?$/,
				params: [{"name":"slug","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0], errors: [1], leaf: 4 },
				endpoint: null
			},
			{
				id: "/en/skill",
				pattern: /^\/en\/skill\/?$/,
				params: [],
				page: { layouts: [0], errors: [1], leaf: 6 },
				endpoint: null
			},
			{
				id: "/en/[slug]",
				pattern: /^\/en\/([^/]+?)\/?$/,
				params: [{"name":"slug","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0], errors: [1], leaf: 5 },
				endpoint: null
			},
			{
				id: "/gallery",
				pattern: /^\/gallery\/?$/,
				params: [],
				page: { layouts: [0], errors: [1], leaf: 7 },
				endpoint: null
			},
			{
				id: "/skill",
				pattern: /^\/skill\/?$/,
				params: [],
				page: { layouts: [0], errors: [1], leaf: 8 },
				endpoint: null
			},
			{
				id: "/skill/[slug]",
				pattern: /^\/skill\/([^/]+?)\/?$/,
				params: [{"name":"slug","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0], errors: [1], leaf: 9 },
				endpoint: null
			}
		],
		matchers: async () => {
			
			return {  };
		}
	}
};
