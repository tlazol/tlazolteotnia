export function selectPaintBackground(
  images: readonly string[],
  random: () => number = Math.random
): string {
  if (images.length === 0) {
    throw new Error('At least one paint background image is required.')
  }

  return images[Math.floor(random() * images.length)]
}
