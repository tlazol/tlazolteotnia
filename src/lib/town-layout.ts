type Point = { x: number; z: number }
export type TownRoad = { points: Point[]; width: number; trail?: boolean }
export type TownBuildingKind =
  | 'house'
  | 'shop'
  | 'burger'
  | 'bakery'
  | 'arcade'
  | 'hotel'
  | 'hospital'
  | 'apartment'
  | 'city-hall'
  | 'library'
  | 'police'
  | 'cafe'
  | 'florist'
  | 'workshop'
  | 'townhouse'
  | 'post-office'
  | 'cinema'
  | 'fire-station'
  | 'market'
  | 'cottage'
  | 'office'
export type TownBuilding = Point & {
  kind: TownBuildingKind
  variant: number
  label?: string
  scale: number
  frontage: Point
}

// Undo the reference map's oblique drawing before placing it in the 3D world.
// Both street axes have equal scale; the camera supplies all perspective.
export function onettToTown(x: number, y: number): Point {
  return { x: x + y - 445, z: y * Math.SQRT2 - 1595 }
}

// The street grid uses board coordinates from the daytime Onett map.
// Reference: https://www.ssbwiki.com/images/5/50/OnettEB.png
function road(width: number, points: [number, number][], trail = false): TownRoad {
  return { width, points: points.map(([x, y]) => onettToTown(x, y)), trail }
}

// Street frontages are shared by the road mesh and the lots along it.
const northStreet = road(78, [
  [-100, 850],
  [3050, 850]
])
const civicStreet = road(78, [
  [-350, 1450],
  [3000, 1450]
])
const southStreet = road(78, [
  [-500, 2000],
  [2800, 2000]
])
const westLane = road(58, [
  [-150, 1150],
  [600, 1150],
  [1550, 1150],
  [2550, 1150],
  [3150, 1150]
])
const marketLane = road(58, [
  [-660, 1710],
  [40, 1710],
  [990, 1710],
  [1990, 1710],
  [2890, 1710]
])
const coastLane = road(58, [
  [-550, 2300],
  [400, 2300],
  [1400, 2300],
  [2500, 2300]
])
const libraryLane = road(
  28,
  [
    [100, 500],
    [595, 500],
    [3100, 500]
  ],
  true
)
const hillLane = road(
  28,
  [
    [1150, -100],
    [3350, -100]
  ],
  true
)

export const onettRoads: TownRoad[] = [
  northStreet,
  civicStreet,
  southStreet,
  road(78, [
    [900, 850],
    [300, 1450],
    [-250, 2000],
    [-550, 2300]
  ]),
  road(78, [
    [1850, 850],
    [1250, 1450],
    [700, 2000],
    [400, 2300]
  ]),
  road(78, [
    [2850, 850],
    [2250, 1450],
    [1700, 2000],
    [1400, 2300]
  ]),
  westLane,
  marketLane,
  coastLane,
  libraryLane,
  hillLane,
  // The northern footpaths meet the streets at ground level, below the hills.
  road(
    28,
    [
      [2800, -100],
      [2200, 500],
      [1850, 850]
    ],
    true
  )
]

// Local bounds include eaves, fences, porches and shop furniture, not just walls.
export function townBuildingFootprint(kind: TownBuildingKind) {
  switch (kind) {
    case 'library':
    case 'police':
      return { left: -246, right: 246, back: -190, front: 192 }
    case 'city-hall':
      return { left: -194, right: 194, back: -99, front: 174 }
    case 'house':
      return { left: -128, right: 151, back: -98, front: 155 }
    case 'townhouse':
      return { left: -119, right: 119, back: -86, front: 149 }
    case 'cottage':
      return { left: -102, right: 102, back: -84, front: 169 }
    case 'cafe':
    case 'florist':
      return { left: -128, right: 128, back: -91, front: 178 }
    case 'workshop':
      return { left: -128, right: 142, back: -91, front: 136 }
    case 'fire-station':
      return { left: -132, right: 132, back: -89, front: 175 }
    case 'cinema':
      return { left: -132, right: 142, back: -89, front: 166 }
    case 'post-office':
    case 'market':
      return { left: -132, right: 142, back: -92, front: 150 }
    default:
      return { left: -140, right: 166, back: kind === 'arcade' ? -148 : -96, front: 193 }
  }
}

function building(
  kind: TownBuildingKind,
  street: TownRoad,
  x: number,
  variant = 0,
  label?: string,
  scale = 1
): TownBuilding {
  const frontage = {
    x,
    z: street.points[0].z - street.width / 2 - (street.trail ? 0 : 18)
  }
  return {
    x,
    z: frontage.z - townBuildingFootprint(kind).front * scale - 12,
    kind,
    variant,
    label,
    scale,
    frontage
  }
}

export const onettBuildings: TownBuilding[] = [
  building('city-hall', civicStreet, 1740, 0, 'TOWN HALL', 1.1),
  building('library', libraryLane, 1940, 0, 'LIBRARY'),
  building('hospital', civicStreet, 920, 0, 'HOSPITAL', 1.05),
  building('hotel', civicStreet, 2650, 0, 'HOTEL', 1.05),
  building('apartment', civicStreet, 2990, 1),
  building('apartment', westLane, 2580, 0),
  building('townhouse', westLane, 2940, 2),
  building('townhouse', westLane, 870, 1),
  building('apartment', northStreet, 470, 0),
  building('police', northStreet, 960, 0, 'POLICE'),
  building('shop', northStreet, 1530, 0, 'DRUGS'),
  building('burger', northStreet, 1825, 2, 'BURGER', 0.9),
  building('cafe', southStreet, 2700, 3, 'CAFE'),
  building('bakery', southStreet, 1590, 2, 'BAKERY'),
  building('arcade', southStreet, 1940, 1, 'GAME', 0.85),
  building('florist', marketLane, 2530, 1, 'FLOWERS', 0.9),
  building('apartment', marketLane, 2020, 2, undefined, 0.85),
  building('workshop', westLane, 1530, 2, 'WORKSHOP'),
  building('house', westLane, 1850, 0),
  building('house', westLane, 3530, 0),
  building('townhouse', civicStreet, 3500, 0),
  building('house', marketLane, 3910, 3, undefined, 0.9),
  building('house', southStreet, 3700, 0),
  building('house', northStreet, 2970, 3, undefined, 0.7),
  building('house', northStreet, 2690, 0, undefined, 0.7),
  building('house', coastLane, 1540, 0, undefined, 0.7),
  building('house', coastLane, 1770, 3, undefined, 0.7),
  building('house', civicStreet, 660, 3, undefined, 0.6),
  building('library', libraryLane, 430, 1),
  building('library', libraryLane, 1010, 1),
  building('house', hillLane, 1940, 0, "NESS'S HOUSE", 1.15),
  building('house', hillLane, 2590, 2, undefined, 1.15),
  building('house', hillLane, 1140, 3, undefined, 0.6),
  building('house', hillLane, 690, 3, undefined, 0.65),
  // Smaller lots share the same setback and access rules as the landmarks.
  building('post-office', westLane, 2100, 0, 'POST', 0.65),
  building('cottage', civicStreet, 2070, 1, undefined, 0.65),
  building('market', civicStreet, 2400, 0, 'MARKET', 0.65),
  building('cottage', westLane, 3790, 3, undefined, 0.65),
  building('fire-station', marketLane, 1530, 0, 'FIRE', 0.65),
  building('townhouse', marketLane, 1760, 3, undefined, 0.65),
  building('cinema', marketLane, 2800, 0, 'CINEMA', 0.65),
  building('cafe', marketLane, 3470, 0, 'CAFE', 0.65),
  building('cottage', marketLane, 3680, 2, undefined, 0.65),
  building('market', marketLane, 1080, 1, 'MARKET', 0.65),
  building('office', southStreet, 2440, 0, undefined, 0.65),
  building('townhouse', southStreet, 3940, 1, undefined, 0.65),
  building('florist', southStreet, 4190, 0, 'FLOWERS', 0.65),
  building('cottage', coastLane, 2010, 0, undefined, 0.65),
  building('house', coastLane, 2420, 1, undefined, 0.65),
  building('bakery', coastLane, 2640, 3, 'BAKERY', 0.65),
  building('cottage', coastLane, 2870, 2, undefined, 0.65),
  building('post-office', coastLane, 3100, 1, 'POST', 0.65),
  building('townhouse', coastLane, 3430, 2, undefined, 0.65),
  building('house', coastLane, 3660, 1, undefined, 0.65),
  building('workshop', coastLane, 3900, 0, 'WORKSHOP', 0.65),
  building('cottage', coastLane, 4150, 3, undefined, 0.65),
  building('office', northStreet, 2080, 1, undefined, 0.65),
  building('cinema', northStreet, 2420, 1, 'CINEMA', 0.65),
  building('cottage', libraryLane, 2690, 0, undefined, 0.65),
  building('house', libraryLane, 2930, 1, undefined, 0.65)
]

export function townBuildingBounds(lot: TownBuilding) {
  const footprint = townBuildingFootprint(lot.kind)
  return {
    left: lot.x + footprint.left * lot.scale,
    right: lot.x + footprint.right * lot.scale,
    back: lot.z + footprint.back * lot.scale,
    front: lot.z + footprint.front * lot.scale
  }
}

// Continue each model's existing entrance paving to the shared sidewalk edge.
export function townBuildingAccess(lot: TownBuilding) {
  const entrances =
    lot.kind === 'townhouse'
      ? [-29, 85]
      : lot.kind === 'cafe' || lot.kind === 'florist'
        ? [63]
        : lot.kind === 'workshop'
          ? [-76]
          : lot.kind === 'fire-station'
            ? [-66, 27, 92]
            : lot.kind === 'market'
              ? [-78, 0, 78]
              : [0]
  const start =
    lot.kind === 'library' || lot.kind === 'police'
      ? 188
      : lot.kind === 'house' || lot.kind === 'townhouse'
        ? 140
        : lot.kind === 'cottage' || lot.kind === 'city-hall'
          ? 160
          : lot.kind === 'cafe' || lot.kind === 'florist' || lot.kind === 'workshop'
            ? 110
            : lot.kind === 'market'
              ? 138
              : 100
  return entrances.map((x) => ({
    x: lot.x + x * lot.scale,
    start: lot.z + start * lot.scale,
    end: lot.frontage.z + 2,
    width: 28 * lot.scale
  }))
}

// Gardens occupy spare parcels and open onto the adjoining lane.
export const onettParks = [
  { x: 1480, z: libraryLane.points[0].z - 124, frontage: libraryLane.points[0].z - 14 },
  { x: 850, z: marketLane.points[0].z - 177, frontage: marketLane.points[0].z - 47 },
  { x: 3060, z: marketLane.points[0].z - 177, frontage: marketLane.points[0].z - 47 }
]

// Tree belts enclose the town and separate the northern trails from the civic blocks.
export const onettGroves = [
  { x: -360, y: 1040, rx: 140, ry: 1110 },
  { x: 3300, y: 1210, rx: 210, ry: 1120 },
  { x: 380, y: 2490, rx: 700, ry: 190 },
  { x: 2350, y: 2470, rx: 1190, ry: 210 },
  { x: 960, y: 480, rx: 600, ry: 160 },
  { x: 2040, y: 160, rx: 390, ry: 170 },
  { x: 2860, y: 520, rx: 400, ry: 160 },
  { x: 500, y: -150, rx: 530, ry: 190 },
  { x: 2270, y: -70, rx: 620, ry: 150 }
]

export const onettHills = [
  { x: 600, y: -620, width: 1250, depth: 670, height: 105 },
  { x: 1710, y: -1050, width: 1090, depth: 850, height: 165 },
  { x: 2680, y: -950, width: 1390, depth: 540, height: 115 }
]

export function nearestTownRoad(point: Point, roads: TownRoad[]) {
  let distance = Number.POSITIVE_INFINITY
  let nearest = point
  for (const road of roads) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]
      const b = road.points[i]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const length = Math.hypot(dx, dz)
      const along = ((point.x - a.x) * dx + (point.z - a.z) * dz) / length
      const across = ((point.x - a.x) * dz - (point.z - a.z) * dx) / length
      const t = Math.max(0, Math.min(1, along / length))
      const projected = { x: a.x + t * dx, z: a.z + t * dz }
      // Match the rendered square end caps, including their sidewalk corners.
      const halfWidth = road.width / 2 + (road.trail ? 0 : 18)
      const side = Math.abs(across) - halfWidth
      const end = Math.abs(along - length / 2) - length / 2 - halfWidth
      const clearance =
        Math.hypot(Math.max(side, 0), Math.max(end, 0)) + Math.min(Math.max(side, end), 0)
      if (clearance < distance) {
        distance = clearance
        nearest = projected
      }
    }
  }
  return { distance, point: nearest }
}
