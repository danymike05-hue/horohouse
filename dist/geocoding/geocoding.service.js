"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GeocodingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeocodingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const BASE = 'https://nominatim.openstreetmap.org';
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 3000;
let GeocodingService = GeocodingService_1 = class GeocodingService {
    logger = new common_1.Logger(GeocodingService_1.name);
    cache = new Map();
    queue = Promise.resolve();
    lastCall = 0;
    userAgent;
    constructor(config) {
        const contact = config.get('NOMINATIM_EMAIL') ?? config.get('FROM_EMAIL') ?? '';
        this.userAgent = `HoroHouse/1.0${contact ? ` (${contact})` : ''}`;
    }
    async search(opts) {
        const q = String(opts.q ?? '').trim();
        if (q.length < 3)
            return [];
        if (q.length > 200)
            throw new common_1.BadRequestException('Search text is too long');
        const params = {
            format: 'json',
            q,
            addressdetails: '1',
            limit: String(Math.min(Math.max(Number(opts.limit) || 5, 1), 10)),
            countrycodes: /^[a-z]{2}(,[a-z]{2}){0,9}$/i.test(opts.countrycodes ?? '') ? opts.countrycodes.toLowerCase() : 'cm',
        };
        if (opts.viewbox && /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(opts.viewbox)) {
            params.viewbox = opts.viewbox;
            params.bounded = '0';
        }
        const data = await this.fetch('/search', params, opts.lang);
        return (Array.isArray(data) ? data : []).map((p) => this.clean(p));
    }
    async reverse(lat, lon, lang) {
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            throw new common_1.BadRequestException('Invalid coordinates');
        }
        const data = await this.fetch('/reverse', { format: 'json', lat: lat.toFixed(4), lon: lon.toFixed(4), addressdetails: '1', zoom: '18' }, lang);
        return data?.display_name ? this.clean(data) : null;
    }
    clean(p) {
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
    async fetch(path, params, lang) {
        const acceptLanguage = lang?.toLowerCase().startsWith('en') ? 'en,fr;q=0.8' : 'fr,en;q=0.8';
        const key = `${path}?${new URLSearchParams(params).toString()}#${acceptLanguage}`;
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS)
            return hit.data;
        const run = this.queue.then(async () => {
            const wait = this.lastCall + MIN_INTERVAL_MS - Date.now();
            if (wait > 0)
                await new Promise((r) => setTimeout(r, wait));
            this.lastCall = Date.now();
            const res = await axios_1.default.get(`${BASE}${path}`, {
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
                if (oldest)
                    this.cache.delete(oldest);
            }
            this.cache.set(key, { at: Date.now(), data });
            return data;
        }
        catch (err) {
            this.logger.warn(`Nominatim ${path} failed: ${err?.message}`);
            throw new common_1.ServiceUnavailableException('Address search is unavailable right now');
        }
    }
};
exports.GeocodingService = GeocodingService;
exports.GeocodingService = GeocodingService = GeocodingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeocodingService);
//# sourceMappingURL=geocoding.service.js.map