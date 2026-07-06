const postEmojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮']

const postAuthors = [
  'CHΔ0S://9X_QR',
  'SYS∴VANTA_404',
  'RX#NØISE',
  'NULL://FANG_7',
  'KERNEL∴MOTH',
  'HEX#GHOST_09',
  'VØID://PAWS',
  'NYX∴ECHO_13',
  'CRYPT#ΩRBIT',
  'XENØ://DREAM',
  'SIGIL∴404_QR',
  'NOVA#STATIC',
  'ØMEN://BYTE',
  'RIFT∴KITSUNE',
  'GLITCH#PALE',
  'MØTH://NEON_5'
]

export function getPostEmoji(slug: string) {
  return postEmojis[getPostHash(slug) % postEmojis.length]
}

export function getPostAuthor(slug: string) {
  return postAuthors[getPostHash(slug) % postAuthors.length]
}

function getPostHash(slug: string) {
  let hash = 0

  for (const character of slug) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  }

  return hash
}
