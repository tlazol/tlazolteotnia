// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      lang: 'ja-JP' | 'en-US'
    }
    interface PageData {
      gtagId: string
      meta: {
        title: string
        description: string
        img: string
        url: string
      } | null
    }
    // interface Platform {}
  }
}

export {}
