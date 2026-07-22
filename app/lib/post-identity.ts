export type PostIdentity = {
  emoji: string
  author: string
  species: string
}

const callSignGlyphs: Record<string, string> = {
  A: '∆',
  E: 'Ξ',
  I: '⮒',
  O: 'Ø',
  U: '∪'
}

// Every published article has its own member of the animal relay. Keeping the
// roster explicit prevents hash collisions and makes a new animal a deliberate
// part of publishing a new article.
const postIdentities: Record<string, PostIdentity> = {
  'actions-builder-transactions-migration': animal('🦝', 'RACCØON://LEDGER', 'アライグマ'),
  'better-output-structure': animal('🦫', 'BEAVER://SCHEMA', 'ビーバー'),
  'better-output-ten-tips': animal('🐙', 'ØCTØ://TENFOLD', 'タコ'),
  'chaos-zero-nightmare-is-good': animal('🐺', 'WØLF://CHAOS', 'オオカミ'),
  'css-centering-five-ways': animal('🕷️', 'SPIDER://CENTER', 'クモ'),
  'css-currentcolor': animal('🦎', 'CHAMELEØN://HUE', 'カメレオン'),
  'cypress-form-whoops-no-test': animal('🦗', 'CRICKET://SPEC', 'コオロギ'),
  'dialogflow-actions-builder-migration': animal('🦜', 'PARROT://DIALOG', 'オウム'),
  'dialogflow-actions-builder-simulator-version': animal('🐦', 'FINCH://SIM', 'フィンチ'),
  'firebase-contentful-markdown-blog': animal('🦘', 'KANGARØØ://CMS', 'カンガルー'),
  'firebase-multiple-project-initialize': animal('🐧', 'PENGUIN://MULTI', 'ペンギン'),
  'firestore-like-button-data-structure': animal('🐿️', 'SQUIRREL://LIKE', 'リス'),
  'frontend-engineer-or-javascript-engineer': animal('🦉', 'ØWL://FRONTEND', 'フクロウ'),
  'glassmorphism-lessons': animal('🩼', 'JELLY://GLASS', 'クラゲ'),
  'glassmorphism-site-lessons': animal('🦚', 'PEACØCK://PRISM', 'クジャク'),
  'google-assistant-actions-lessons': animal('🐬', 'DØLPHIN://VOICE', 'イルカ'),
  'google-assistant-vui-design': animal('🦇', 'BAT://ECHO', 'コウモリ'),
  'google-tag-manager-overview': animal('🦓', 'ZEBRA://TAG', 'シマウマ'),
  'gpt-english-email-tips': animal('🐤', 'CHICK://MAIL', 'ヒヨコ'),
  'gpt4-tetris-prompt': animal('🦙', 'LLAMA://BLOCKS', 'リャマ'),
  'how-to-reset-colima': animal('🦦', 'OTTER://COLIMA', 'カワウソ'),
  'lambdatest-e2e-platform': animal('🐏', 'RAM://E2E', 'ヒツジ'),
  'langchain-typescript-chatgpt-search': animal('🐍', 'SERPENT://CHAIN', 'ヘビ'),
  'localization-writing-structure': animal('🦆', 'DUCK://LOCALE', 'カモ'),
  'max-width-parent-layout': animal('🐢', 'TØRTØISE://WIDTH', 'リクガメ'),
  'migration-to-cloudflare': animal('🦅', 'EAGLE://CLOUD', 'ワシ'),
  'multiple-pwa-service-workers-domain': animal('🐝', 'BEE://WORKERS', 'ミツバチ'),
  'nightmarejs-phantomjs-puppeteer-performance': animal('🐎', 'STALLIØN://RACE', 'ウマ'),
  'online-english-conversation': animal('🦭', 'SEAL://TALK', 'アザラシ'),
  'people-who-use-enter-to-send-need-to-think-about-people-who-use-it-to-convert': animal(
    '🦨',
    'SKUNK://IME',
    'スカンク'
  ),
  'perspective-drawing-introduction': animal('🦒', 'GIRAFFE://VANISH', 'キリン'),
  'react-router-renewal': animal('🦊', 'FØX://ROUTER', 'キツネ'),
  'resume-writing-notes': animal('🦔', 'HEDGEHØG://CV', 'ハリネズミ'),
  'rpg-attack-logic': animal('🐅', 'TIGER://CRIT', 'トラ'),
  'ssml-speakable-characters': animal('🐸', 'FRØG://SSML', 'カエル'),
  'still-dont-know-best-way-to-count-documents-in-documentdb': animal(
    '🦡',
    'BADGER://COUNT',
    'アナグマ'
  ),
  'svelte-express-ssr': animal('🐇', 'HARE://SSR', 'ノウサギ'),
  'svelte-multiple-script-tags': animal('🦑', 'SQUID://SCRIPTS', 'イカ'),
  'sveltekit-third-party-script-chatgpt': animal('🐒', 'MACAQUE://GPT', 'マカク'),
  'sveltekit-third-party-script': animal('🦍', 'GØRILLA://THIRD', 'ゴリラ'),
  'sveltekit-vercel-renewal': animal('🦌', 'DEER://DEPLOY', 'シカ'),
  'vue-lightsout-game': animal('🦋', 'BUTTERFLY://LIGHTS', 'チョウ'),
  'vui-idle-hack-and-slash-rpg': animal('🦁', 'LIØN://IDLE', 'ライオン'),
  'why-not-just-try-yourself': animal('🐗', 'BØAR://TRY', 'イノシシ')
}

const fallbackIdentity = animal('🐾', 'NEWCØMER://SIGNAL', 'なかま')

export function getPostIdentity(slug: string): PostIdentity {
  return postIdentities[slug] ?? fallbackIdentity
}

export function getPostEmoji(slug: string) {
  return getPostIdentity(slug).emoji
}

export function getPostAuthor(slug: string) {
  return getPostIdentity(slug).author
}

export function getPostSpecies(slug: string) {
  return getPostIdentity(slug).species
}

function animal(emoji: string, author: string, species: string): PostIdentity {
  return { emoji, author: distortCallsign(author), species }
}

function distortCallsign(author: string) {
  return author
    .replace('://', '⫶')
    .split(/(⫶)/)
    .map((part) => {
      if (part === '⫶') return part

      const glyphs = Array.from(part, (character) => callSignGlyphs[character] ?? character)
      if (glyphs.length >= 5) glyphs.splice(-2, 0, '·')
      return glyphs.join('')
    })
    .join('')
}
