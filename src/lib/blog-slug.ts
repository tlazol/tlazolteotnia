const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(slug: string) {
  return slugPattern.test(slug)
}
