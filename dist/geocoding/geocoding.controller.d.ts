import { GeocodingService } from './geocoding.service';
export declare class GeocodingController {
    private readonly geocoding;
    constructor(geocoding: GeocodingService);
    search(q: string, limit?: string, countrycodes?: string, viewbox?: string, lang?: string): Promise<import("./geocoding.service").GeoPlace[]>;
    reverse(lat: string, lon: string, lang?: string): Promise<import("./geocoding.service").GeoPlace | null>;
}
