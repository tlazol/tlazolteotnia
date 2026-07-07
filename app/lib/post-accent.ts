const postAccents = ['green', 'blue', 'pink', 'yellow', 'red'] as const

export type PostAccent = (typeof postAccents)[number]

export function getPostAccent(slug: string): PostAccent {
  let hash = 0

  for (const character of slug) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  }

  return postAccents[hash % postAccents.length]
}
