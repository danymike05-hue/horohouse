/**
 * Where listings may be placed. HoroHouse runs in Cameroon only for now: new listings and
 * edited locations must fall inside the country's bounding box.
 *
 * The box is a rectangle, so it also covers small strips of neighbouring countries along
 * the border. The app only suggests Cameroonian addresses (geocoding with countrycodes=cm)
 * and checks the reverse-geocoded country code, so in practice pins land in Cameroon.
 *
 * To open another country later, add its box here and its code to LISTING_COUNTRY_CODES.
 */
export const CAMEROON_BOUNDS = {
  minLat: 1.65,
  maxLat: 13.08,
  minLng: 8.49,
  maxLng: 16.19,
} as const;

/** Nominatim country codes accepted for listings */
export const LISTING_COUNTRY_CODES = ['cm'];

/** Name stored on every listing */
export const LISTING_COUNTRY = 'Cameroon';

export function isInCameroon(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  return (
    la >= CAMEROON_BOUNDS.minLat &&
    la <= CAMEROON_BOUNDS.maxLat &&
    lo >= CAMEROON_BOUNDS.minLng &&
    lo <= CAMEROON_BOUNDS.maxLng
  );
}
