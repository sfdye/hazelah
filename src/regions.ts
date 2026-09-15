import { RegionMetadata, RegionName } from './types';

export type { RegionName };

// labelLocation values from NEA regionMetadata (stable; hardcoded so region
// resolution works before the API responds)
export const REGIONS: RegionMetadata[] = [
  { name: 'central', labelLocation: { latitude: 1.35735, longitude: 103.82 } },
  { name: 'east', labelLocation: { latitude: 1.35735, longitude: 103.94 } },
  { name: 'north', labelLocation: { latitude: 1.41803, longitude: 103.82 } },
  { name: 'south', labelLocation: { latitude: 1.29587, longitude: 103.82 } },
  { name: 'west', labelLocation: { latitude: 1.35735, longitude: 103.7 } },
];

export function nearestRegion(latitude: number, longitude: number): RegionName {
  let best = REGIONS[0];
  let bestDist = Infinity;
  for (const r of REGIONS) {
    const dLat = r.labelLocation.latitude - latitude;
    const dLng = r.labelLocation.longitude - longitude;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best.name;
}

export function regionLabel(name: RegionName): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
