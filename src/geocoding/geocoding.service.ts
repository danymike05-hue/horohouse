import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Address search and reverse lookup through OpenStreetMap Nominatim, called from the
 * server instead of every phone.
 *
 * Nominatim's usage policy: at most 1 request per second, an identifying User-Agent,
 * and cache results. Phones calling it directly break all three (React Native can't
 * set User-Agent reliably, and every user counts against the same limit), which gets
 * the app's traffic blocked. Here requests are queued one per second and cached.
 */
export interface GeoPlace {
  place_id?: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type?: string;
  address?: Record<string, string>;
}

const BASE = 'https://nominatim.openstreetmap.org';
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 3000;

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, { at: number; data: any }>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;
  private readonly userAgent: string;

  constructor(config: ConfigService) {
    const contact = config.get<string>('NOMINATIM_EMAIL') ?? config.get<string>('FROM_EMAIL') ?? '';
    this.userAgent = `HoroHouse/1.0${contact ? ` (${contact})` : ''}`;
  }

  async search(opts: {
    q: string;
    limit?: number;
    countrycodes?: string;
    viewbox?: string;
    lang?: string;
  }): Promise<GeoPlace[]> {
    const q = String(opts.q ?? '').trim();
    if (q.length < 3) return [];
    if (q.length > 200) throw new BadRequestException('Search text is too long');

    const params: Record<string, string> = {
      format: 'json',
      q,
      addressdetails: '1',
      limit: String(Math.min(Math.max(Number(opts.limit) || 5, 1), 10)),
      countrycodes: /^[a-z]{2}(,[a-z]{2}){0,9}$/i.test(opts.countrycodes ?? '') ? opts.countrycodes!.toLowerCase() : 'cm',
    };
    if (opts.viewbox && /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(opts.viewbox)) {
      params.viewbox = opts.viewbox;
      params.bounded = '0';
    }
    const data = await this.fetch('/search', params, opts.lang);
    return (Array.isArray(data) ? data : []).map((p: any) => this.clean(p));
  }

  async reverse(lat: number, lon: number, lang?: string): Promise<GeoPlace | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new BadRequestException('Invalid coordinates');
    }
    // ~11 m precision is plenty for an address and lets nearby taps share the cache.
    const data = await this.fetch(
      '/reverse',
      { format: 'json', lat: lat.toFixed(4), lon: lon.toFixed(4), addressdetails: '1', zoom: '18' },
      lang,
    );
    return data?.display_name ? this.clean(data) : null;
  }

  private clean(p: any): GeoPlace {
    return {
      place_id: p.place_id,
      display_name: p.display_name,
      name: p.name,
      lat: String(p.lat),
      lon: String(p.lon),
      type: p.type,
      address: p.address,
    };
  }

  private async fetch(path: string, params: Record<string, string>, lang?: string): Promise<any> {
    const acceptLanguage = lang?.toLowerCase().startsWith('en') ? 'en,fr;q=0.8' : 'fr,en;q=0.8';
    const key = `${path}?${new URLSearchParams(params).toString()}#${acceptLanguage}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

    // One request at a time, at least MIN_INTERVAL_MS apart.
    const run = this.queue.then(async () => {
      const wait = this.lastCall + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCall = Date.now();
      const res = await axios.get(`${BASE}${path}`, {
        params,
        headers: { 'User-Agent': this.userAgent, 'Accept-Language': acceptLanguage },
        timeout: 6000,
      });
      return res.data;
    });
    this.queue = run.catch(() => undefined);

    try {
      const data = await run;
      if (this.cache.size >= CACHE_MAX) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
      this.cache.set(key, { at: Date.now(), data });
      return data;
    } catch (err: any) {
      this.logger.warn(`Nominatim ${path} failed: ${err?.message}`);
      throw new ServiceUnavailableException('Address search is unavailable right now');
    }
  }
}
