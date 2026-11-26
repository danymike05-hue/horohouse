import { distanceM, pickNearby } from './nearby.service';

describe('nearby places', () => {
  const HOME = { lat: 4.05, lon: 9.7 };
  const node = (tags: Record<string, string>, dLat = 0.001, dLon = 0) => ({ type: 'node', lat: HOME.lat + dLat, lon: HOME.lon + dLon, tags });

  it('measures distances in metres', () => {
    expect(distanceM(4.05, 9.7, 4.051, 9.7)).toBeGreaterThan(100);
    expect(distanceM(4.05, 9.7, 4.051, 9.7)).toBeLessThan(120);
  });

  it('sorts places into categories', () => {
    const places = pickNearby([
      node({ amenity: 'place_of_worship', religion: 'christian', name: 'Paroisse Saint-Pierre' }),
      node({ amenity: 'place_of_worship', religion: 'muslim', name: 'Mosquée centrale' }),
      node({ amenity: 'hospital', name: 'Hôpital Laquintinie' }),
      node({ amenity: 'restaurant', name: 'Chez Wou' }),
      node({ shop: 'supermarket', name: 'Santa Lucia' }),
      node({ amenity: 'bench' }),
    ], HOME.lat, HOME.lon);
    expect(places.map((p) => p.category).sort()).toEqual(['church', 'hospital', 'market', 'mosque', 'restaurant']);
  });

  it('reads the centre of buildings, nearest first, without doubles', () => {
    const places = pickNearby([
      { type: 'way', center: { lat: HOME.lat + 0.01, lon: HOME.lon }, tags: { amenity: 'school', name: 'Far school' } },
      node({ amenity: 'school', name: 'Near school' }),
      node({ amenity: 'school', name: 'Near school' }),
    ], HOME.lat, HOME.lon);
    expect(places.map((p) => p.name)).toEqual(['Near school', 'Far school']);
  });

  it('keeps at most five per category, named ones first', () => {
    const many = Array.from({ length: 8 }, (_, i) => node({ amenity: 'restaurant', ...(i === 7 ? { name: 'Named' } : {}) }, 0.0005 * (i + 1)));
    const places = pickNearby(many, HOME.lat, HOME.lon);
    expect(places).toHaveLength(5);
    expect(places.some((p) => p.name === 'Named')).toBe(true);
  });
});
