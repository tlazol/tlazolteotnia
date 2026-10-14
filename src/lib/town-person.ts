// Stable order preserves the article-to-costume mapping. Each resident is designed
// as a girl; the role names are costume identifiers, not the old body designs.
export const townPersonStyles = [
  { role: 'cap-child', hair: 'bob', scale: 0.88, skirt: false, face: 0 },
  { role: 'dress-child', hair: 'twintails', scale: 0.88, skirt: true, face: 4 },
  { role: 'casual', hair: 'waves', scale: 1, skirt: false, face: 3 },
  { role: 'dress', hair: 'long', scale: 1, skirt: true, face: 1 },
  { role: 'hoodie', hair: 'short', scale: 0.96, skirt: false, face: 2 },
  { role: 'cardigan', hair: 'ponytail', scale: 1, skirt: true, face: 5 },
  { role: 'kindergartner', hair: 'braids', scale: 0.84, skirt: true, face: 3 },
  { role: 'schoolchild', hair: 'bob', scale: 0.9, skirt: true, face: 2 },
  { role: 'student', hair: 'long', scale: 0.96, skirt: true, face: 0 },
  { role: 'salaryman', hair: 'ponytail', scale: 1, skirt: false, face: 3 },
  { role: 'doctor', hair: 'braids', scale: 1, skirt: false, face: 5 },
  { role: 'office-lady', hair: 'bun', scale: 1, skirt: true, face: 1 },
  { role: 'magical-girl', hair: 'twintails', scale: 0.96, skirt: true, face: 4 },
  { role: 'chef', hair: 'bun', scale: 0.98, skirt: true, face: 3 },
  { role: 'firefighter', hair: 'ponytail', scale: 1, skirt: false, face: 0 },
  { role: 'police', hair: 'bob', scale: 1, skirt: true, face: 5 },
  { role: 'builder', hair: 'braids', scale: 0.98, skirt: false, face: 2 },
  { role: 'farmer', hair: 'twintails', scale: 0.96, skirt: false, face: 3 },
  { role: 'astronaut', hair: 'short', scale: 1, skirt: false, face: 0 },
  { role: 'alien', hair: 'bun', scale: 0.96, skirt: true, face: 4 },
  { role: 'nurse', hair: 'bob', scale: 1, skirt: true, face: 4 },
  { role: 'hero', hair: 'ponytail', scale: 1, skirt: true, face: 2 },
  { role: 'wizard', hair: 'waves', scale: 1, skirt: true, face: 5 },
  { role: 'witch', hair: 'long', scale: 1, skirt: true, face: 1 },
  { role: 'knight', hair: 'braids', scale: 1, skirt: true, face: 0 },
  { role: 'ninja', hair: 'ponytail', scale: 0.96, skirt: false, face: 5 },
  { role: 'pirate', hair: 'waves', scale: 1, skirt: true, face: 3 },
  { role: 'fairy', hair: 'twintails', scale: 0.88, skirt: true, face: 2 },
  { role: 'vampire', hair: 'long', scale: 1, skirt: true, face: 4 },
  { role: 'robot', hair: 'bob', scale: 1, skirt: true, face: 0 }
] as const

export function townPersonStyle(variant: number) {
  return townPersonStyles[variant % townPersonStyles.length]
}
