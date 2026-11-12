// Names shared by the Worker entry and the island's Durable Object.
export const ISLAND_ROOM_NAME = 'public-island'
// Set only by the Worker after verifying the cookie; never copied from the browser.
export const INTERNAL_ACTOR_HEADER = 'X-Island-Actor'
export const INTERNAL_EXPIRES_HEADER = 'X-Island-Expires'
