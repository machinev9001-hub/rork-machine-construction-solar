import { LatLon } from '@/types';

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function haversineKm(pointA: LatLon, pointB: LatLon): number {
  const R = 6371;
  
  const dLat = toRadians(pointB.latitude - pointA.latitude);
  const dLon = toRadians(pointB.longitude - pointA.longitude);
  
  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);
  
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLon = Math.sin(dLon / 2);
  
  const a = sinHalfLat * sinHalfLat + 
            Math.cos(lat1) * Math.cos(lat2) * 
            sinHalfLon * sinHalfLon;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

export function isWithinRadius(
  userLocation: LatLon,
  siteCenter: LatLon,
  radiusKm: number
): { withinRadius: boolean; distanceKm: number } {
  const distanceKm = haversineKm(userLocation, siteCenter);
  return {
    withinRadius: distanceKm <= radiusKm,
    distanceKm,
  };
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(2)}km`;
}
