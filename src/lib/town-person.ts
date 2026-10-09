// Keep the original six silhouettes, then add everyday and fantasy residents.
// Colour selection stays independent of the role, keyed by the article slug.
export const townPersonStyles = [
  { role: 'cap-child', hair: 0, scale: 0.72, skirt: false },
  { role: 'dress-child', hair: 1, scale: 0.72, skirt: true },
  { role: 'casual', hair: 2, scale: 1, skirt: false },
  { role: 'dress', hair: 3, scale: 1, skirt: true },
  { role: 'hoodie', hair: 4, scale: 1, skirt: false },
  { role: 'cardigan', hair: 5, scale: 1, skirt: true },
  { role: 'kindergartner', hair: 0, scale: 0.62, skirt: false },
  { role: 'schoolchild', hair: 1, scale: 0.72, skirt: false },
  { role: 'student', hair: 3, scale: 0.9, skirt: true },
  { role: 'salaryman', hair: 2, scale: 1, skirt: false },
  { role: 'doctor', hair: 2, scale: 1, skirt: false },
  { role: 'office-lady', hair: 5, scale: 1, skirt: true },
  { role: 'magical-girl', hair: 1, scale: 0.9, skirt: true },
  { role: 'chef', hair: 4, scale: 1, skirt: false },
  { role: 'firefighter', hair: 2, scale: 1, skirt: false },
  { role: 'police', hair: 4, scale: 1, skirt: false },
  { role: 'builder', hair: 2, scale: 1, skirt: false },
  { role: 'farmer', hair: 5, scale: 1, skirt: false },
  { role: 'astronaut', hair: 2, scale: 1, skirt: false },
  { role: 'alien', hair: 4, scale: 0.9, skirt: false },
  { role: 'nurse', hair: 5, scale: 1, skirt: false },
  { role: 'hero', hair: 4, scale: 1, skirt: false },
  { role: 'wizard', hair: 2, scale: 1, skirt: false },
  { role: 'witch', hair: 5, scale: 1, skirt: true },
  { role: 'knight', hair: 2, scale: 1, skirt: false },
  { role: 'ninja', hair: 4, scale: 1, skirt: false },
  { role: 'pirate', hair: 2, scale: 1, skirt: false },
  { role: 'fairy', hair: 1, scale: 0.72, skirt: true },
  { role: 'vampire', hair: 2, scale: 1, skirt: false },
  { role: 'robot', hair: 4, scale: 1, skirt: false }
] as const

export function townPersonStyle(variant: number) {
  return townPersonStyles[variant % townPersonStyles.length]
}
