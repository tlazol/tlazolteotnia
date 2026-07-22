const postAccents = ['green', 'blue', 'pink', 'yellow', 'red'] as const

export type PostAccent = (typeof postAccents)[number]

// Keep a stable color per article while resolving hash collisions between
// neighboring articles in the full timeline and tag-filtered timelines.
const accentOverrides: Partial<Record<string, PostAccent>> = {
  'dialogflow-actions-builder-simulator-version': 'pink',
  'firebase-contentful-markdown-blog': 'green',
  'firebase-multiple-project-initialize': 'pink',
  'glassmorphism-lessons': 'blue',
  'rpg-attack-logic': 'yellow',
  'ssml-speakable-characters': 'red',
  'still-dont-know-best-way-to-count-documents-in-documentdb': 'blue',
  'svelte-multiple-script-tags': 'green',
  'vue-lightsout-game': 'blue',
  'vui-idle-hack-and-slash-rpg': 'yellow'
}

export function getPostAccent(slug: string): PostAccent {
  const accentOverride = accentOverrides[slug]

  if (accentOverride) {
    return accentOverride
  }

  let hash = 0

  for (const character of slug) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  }

  return postAccents[hash % postAccents.length]
}
