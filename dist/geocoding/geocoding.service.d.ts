import { ConfigService } from '@nestjs/config';
export interface GeoPlace {
    place_id?: number;
    display_name: string;
    name?: string;
    lat: string;
    lon: string;
    type?: string;
    address?: Record<string, string>;
}
export declare class GeocodingService {
    private readonly logger;
    private readonly cache;
    private queue;
    private lastCall;
    private readonly userAgent;
    constructor(config: ConfigService);
    search(opts: {
        q: string;
        limit?: number;
        countrycodes?: string;
        viewbox?: string;
        lang?: string;
    }): Promise<GeoPlace[]>;
    reverse(lat: number, lon: number, lang?: string): Promise<GeoPlace | null>;
    private clean;
    private fetch;
}
