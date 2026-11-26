import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Places near a listing (churches, mosques, hospitals, restaurants, schools…), read from
 * OpenStreetMap through the Overpass API on the server, never from phones.
 *
 * Overpass asks for an identifying User-Agent and few requests, so calls are queued one
 * at a time and the result for each listing is cached (here, and on the listing itself).
 */
export type NearbyCategory =
  | 'church' | 'mosque' | 'hospital' | 'pharmacy' | 'restaurant' | 'school' | 'market' | 'bank' | 'fuel' | 'transport';

export interface NearbyPlace {
  category: NearbyCategory;
  name: string | null;
  distance: number; // metres, straight line
  lat: number;
  lon: number;
}

/** How far to look, in metres */
export const NEARBY_RADIUS = 2000;
/** At most this many places kept per category, nearest first */
const PER_CATEGORY = 5;

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

/** The OpenStreetMap tags each category is made of */
function categoryOf(tags: Record<string, string>): NearbyCategory | null {
  const a = tags.amenity;
  if (a === 'place_of_worship') {
    if (tags.religion === 'muslim') return 'mosque';
    if (tags.religion === 'christian' || !tags.religion) return 'church';
    return null;
  }
  if (a === 'hospital' || a === 'clinic' || a === 'doctors') return 'hospital';
  if (a === 'pharmacy' || tags.healthcare === 'pharmacy') return 'pharmacy';
  if (a === 'restaurant' || a === 'fast_food' || a === 'cafe') return 'restaurant';
  if (a === 'school' || a === 'university' || a === 'college' || a === 'kindergarten') return 'school';
  if (a === 'marketplace' || tags.shop === 'supermarket' || tags.shop === 'mall') return 'market';
  if (a === 'bank' || a === 'atm') return 'bank';
  if (a === 'fuel') return 'fuel';
  if (a === 'bus_station' || tags.highway === 'bus_stop' || a === 'taxi') return 'transport';
  return null;
}

/** Metres between two points */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Overpass answer → the nearest few places of each category */
export function pickNearby(elements: any[], lat: number, lon: number): NearbyPlace[] {
  const byCat = new Map<NearbyCategory, NearbyPlace[]>();
  const seen = new Set<string>();
  for (const el of elements ?? []) {
    const tags = el?.tags ?? {};
    const cat = categoryOf(tags);
    if (!cat) continue;
    const pLat = Number(el.lat ?? el.center?.lat);
    const pLon = Number(el.lon ?? el.center?.lon);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) continue;
    const name = (tags.name || tags['name:fr'] || tags['name:en'] || '').trim() || null;
    // The same place mapped twice (a building and a point): keep one
    const key = `${cat}|${name ?? ''}|${pLat.toFixed(3)}|${pLon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byCat.get(cat) ?? [];
    list.push({ category: cat, name, distance: distanceM(lat, lon, pLat, pLon), lat: pLat, lon: pLon });
    byCat.set(cat, list);
  }
  const out: NearbyPlace[] = [];
  for (const list of byCat.values()) {
    // Named places first (more useful), then the nearest
    list.sort((a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1) || a.distance - b.distance);
    out.push(...list.slice(0, PER_CATEGORY).sort((a, b) => a.distance - b.distance));
  }
  return out.sort((a, b) => a.distance - b.distance);
}

@Injectable()
export class NearbyService {
  private readonly logger = new Logger(NearbyService.name);
  private readonly userAgent: string;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly cache = new Map<string, { at: number; places: NearbyPlace[] }>();

  constructor(config: ConfigService) {
    const contact = config.get<string>('NOMINATIM_EMAIL') ?? config.get<string>('FROM_EMAIL') ?? '';
    this.userAgent = `HoroHouse/1.0${contact ? ` (${contact})` : ''}`;
  }

  async around(lat: number, lon: number): Promise<NearbyPlace[]> {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 24 * 60 * 60 * 1000) return hit.places;

    const r = NEARBY_RADIUS;
    const at = `(around:${r},${lat},${lon})`;
    const query = `[out:json][timeout:20];(
      nwr${at}["amenity"~"^(place_of_worship|hospital|clinic|doctors|pharmacy|restaurant|fast_food|cafe|school|university|college|kindergarten|marketplace|bank|atm|fuel|bus_station|taxi)$"];
      nwr${at}["shop"~"^(supermarket|mall)$"];
    );out center tags 400;`;

    const run = this.queue.then(async () => {
      let lastErr: any;
      for (const url of SERVERS) {
        try {
          const res = await axios.post(url, `data=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': this.userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 60000,
          });
          return pickNearby(res.data?.elements ?? [], lat, lon);
        } catch (err: any) {
          lastErr = err;
        }
      }
      throw lastErr;
    });
    this.queue = run.catch(() => undefined);

    try {
      const places = await run;
      if (this.cache.size > 2000) this.cache.delete(this.cache.keys().next().value as string);
      this.cache.set(key, { at: Date.now(), places });
      return places;
    } catch (err: any) {
      this.logger.warn(`Overpass failed: ${err?.message}`);
      throw new ServiceUnavailableException('Nearby places are unavailable right now');
    }
  }
}
