export type LinkClick = {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export function shouldOpenPostModal(event: LinkClick) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

// Going back is right only when the entry just before the post is the town;
// otherwise (direct visit, reload, history jumps) navigate to the town instead.
export function shouldClosePostByHistoryBack(
  townHistoryIndex: number | null,
  historyIndex: number
) {
  return townHistoryIndex !== null && townHistoryIndex === historyIndex - 1
}
