export declare const ICAL_TIMEOUT_MS = 10000;
export declare const ICAL_MAX_BYTES: number;
export interface IcalRange {
    from: Date;
    to: Date;
    reason: string;
}
export declare function normalizeIcalUrl(raw: string): string;
export declare function assertSafeIcalUrl(raw: string): Promise<URL>;
export declare function fetchIcal(rawUrl: string, redirects?: number): Promise<string>;
export declare function parseIcalRanges(raw: string, keepAfter?: Date): IcalRange[];
export declare function buildIcalFeed(calendarName: string, events: {
    uid: string;
    from: Date;
    to: Date;
    summary: string;
}[]): string;
