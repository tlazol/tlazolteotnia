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
export type TownBuilding = Point & {
  kind: TownBuildingKind
  variant: number
  label?: string
  scale: number
}

// Undo the reference map's oblique drawing before placing it in the 3D world.
// Both street axes have equal scale; the camera supplies all perspective.
export function onettToTown(x: number, y: number): Point {
  return { x: x + y - 445, z: y * Math.SQRT2 - 1595 }
}

// Fixed landmarks traced from the daytime Onett map, in board coordinates.
// Reference: https://www.ssbwiki.com/images/5/50/OnettEB.png
function road(width: number, points: [number, number][], trail = false): TownRoad {
  return { width, points: points.map(([x, y]) => onettToTown(x, y)), trail }
}

export const onettRoads: TownRoad[] = [
  road(78, [
    [250, 850],
    [2950, 850]
  ]),
  road(78, [
    [-50, 1450],
    [2900, 1450]
  ]),
  road(78, [
    [-200, 2000],
    [2200, 2000]
  ]),
  road(78, [
    [900, 850],
    [300, 1450],
    [-250, 2000]
  ]),
  road(78, [
    [1850, 850],
    [1250, 1450],
    [700, 2000]
  ]),
  road(78, [
    [2850, 850],
    [2250, 1450],
    [1700, 2000]
  ]),
  road(58, [
    [-200, 1800],
    [0, 1800]
  ]),
  road(
    28,
    [
      [1100, 2000],
      [840, 2260],
      [790, 2400]
    ],
    true
  ),
  road(
    28,
    [
      [1620, 850],
      [1870, 600],
      [2310, 600],
      [2470, 440],
      [2770, 440]
    ],
    true
  ),
  road(
    28,
    [
      [1870, 600],
      [1580, 310],
      [1170, 310],
      [1020, 140],
      [1070, -100]
    ],
    true
  ),
  road(
    28,
    [
      [250, 600],
      [470, 600],
      [610, 740]
    ],
    true
  ),
  road(
    28,
    [
      [2770, 440],
      [3010, 160],
      [2800, -50],
      [2690, -50],
      [2440, -300],
      [2580, -440],
      [3130, -440]
    ],
    true
  ),
  road(
    28,
    [
      [2580, -440],
      [2470, -620],
      [2760, -900]
    ],
    true
  ),
  road(
    28,
    [
      [2440, -300],
      [2040, -300],
      [1790, -550],
      [1910, -690],
      [1700, -900],
      [1470, -900]
    ],
    true
  )
]

function building(
  kind: TownBuildingKind,
  x: number,
  y: number,
  variant = 0,
  label?: string,
  scale = 1
): TownBuilding {
  return { ...onettToTown(x, y), kind, variant, label, scale }
}

export const onettBuildings: TownBuilding[] = [
  building('city-hall', 1060, 1190, 0, 'TOWN HALL', 1.1),
  building('library', 1930, 445, 0, 'LIBRARY'),
  building('hospital', -200, 1640, 0, 'HOSPITAL', 1.15),
  building('hotel', 1840, 1220, 0, 'HOTEL', 1.05),
  building('apartment', 2110, 1150, 1),
  building('apartment', 2360, 1030, 0),
  building('townhouse', 2070, 1000, 2),
  building('townhouse', 100, 1030, 1),
  building('apartment', 100, 770, 0),
  building('police', 690, 730, 0, 'POLICE'),
  building('shop', 1100, 705, 0, 'DRUGS'),
  building('burger', 1390, 705, 2, 'BURGER'),
  building('cafe', 1430, 1855, 3, 'CAFE'),
  building('bakery', 590, 1855, 2, 'BAKERY'),
  building('arcade', 1030, 1840, 1, 'GAME'),
  building('florist', 1690, 1590, 1, 'FLOWERS'),
  building('apartment', 810, 1680, 2),
  building('workshop', 400, 1050, 2, 'WORKSHOP'),
  building('house', 120, 1230, 0),
  building('house', 2950, 1090, 0),
  building('townhouse', 2700, 1310, 0),
  building('house', 2440, 1650, 3),
  building('house', 2230, 1850, 0),
  building('house', 2800, 750, 3, undefined, 0.7),
  building('house', 2570, 730, 0, undefined, 0.7),
  building('house', 370, 2220, 0, undefined, 0.7),
  building('house', 600, 2220, 3, undefined, 0.7),
  building('house', -180, 1290, 3, undefined, 0.6),
  building('library', 160, 400, 1),
  building('library', 340, 530, 1),
  building('house', 2750, -550, 0, "NESS'S HOUSE", 1.15),
  building('house', 3220, -540, 2, undefined, 1.15),
  building('house', 1550, -980, 3, undefined, 0.6),
  building('house', 1050, -80, 3, undefined, 0.65)
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
      const t = Math.max(
        0,
        Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz))
      )
      const projected = { x: a.x + t * dx, z: a.z + t * dz }
      const clearance =
        Math.hypot(point.x - projected.x, point.z - projected.z) -
        road.width / 2 -
        (road.trail ? 0 : 18)
      if (clearance < distance) {
        distance = clearance
        nearest = projected
      }
    }
  }
  return { distance, point: nearest }
}
