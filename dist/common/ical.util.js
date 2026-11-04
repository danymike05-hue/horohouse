"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ICAL_MAX_BYTES = exports.ICAL_TIMEOUT_MS = void 0;
exports.normalizeIcalUrl = normalizeIcalUrl;
exports.assertSafeIcalUrl = assertSafeIcalUrl;
exports.fetchIcal = fetchIcal;
exports.parseIcalRanges = parseIcalRanges;
exports.buildIcalFeed = buildIcalFeed;
const common_1 = require("@nestjs/common");
const promises_1 = require("dns/promises");
const net_1 = require("net");
exports.ICAL_TIMEOUT_MS = 10_000;
exports.ICAL_MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
function normalizeIcalUrl(raw) {
    const trimmed = String(raw ?? '').trim();
    return trimmed.replace(/^webcals?:\/\//i, 'https://');
}
function isPrivateAddress(ip) {
    const v = ip.toLowerCase();
    if ((0, net_1.isIP)(v) === 4) {
        return /^(127\.|10\.|192\.168\.|169\.254\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v);
    }
    if ((0, net_1.isIP)(v) === 6) {
        if (v === '::1' || v === '::')
            return true;
        if (/^f[cd][0-9a-f]{2}:/.test(v) || /^fe80:/.test(v))
            return true;
        const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        return mapped ? isPrivateAddress(mapped[1]) : false;
    }
    return false;
}
async function assertSafeIcalUrl(raw) {
    let u;
    try {
        u = new URL(raw);
    }
    catch {
        throw new common_1.BadRequestException('Invalid calendar link');
    }
    if (u.protocol !== 'https:')
        throw new common_1.BadRequestException('The calendar link must start with https://');
    if (u.username || u.password)
        throw new common_1.BadRequestException('This calendar link is not allowed');
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const internalName = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') ||
        host.endsWith('.local') || (!host.includes('.') && !(0, net_1.isIP)(host));
    if (internalName || isPrivateAddress(host))
        throw new common_1.BadRequestException('This calendar link is not allowed');
    if (!(0, net_1.isIP)(host)) {
        let addresses = [];
        try {
            addresses = await (0, promises_1.lookup)(host, { all: true });
        }
        catch {
            throw new common_1.BadRequestException('This calendar link’s website can’t be reached');
        }
        if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
            throw new common_1.BadRequestException('This calendar link is not allowed');
        }
    }
    return u;
}
async function fetchIcal(rawUrl, redirects = 0) {
    const url = await assertSafeIcalUrl(normalizeIcalUrl(rawUrl));
    const https = require('https');
    return new Promise((resolve, reject) => {
        let size = 0;
        let data = '';
        const req = https.get(url, { timeout: exports.ICAL_TIMEOUT_MS, headers: { Accept: 'text/calendar, text/plain, */*', 'User-Agent': 'HoroHouse-Calendar-Sync/1.0' } }, (res) => {
            const status = res.statusCode ?? 0;
            if (status >= 300 && status < 400 && res.headers?.location) {
                res.resume();
                if (redirects >= MAX_REDIRECTS)
                    return reject(new Error('Too many redirects'));
                const next = new URL(res.headers.location, url).toString();
                return fetchIcal(next, redirects + 1).then(resolve, reject);
            }
            if (status !== 200) {
                res.resume();
                return reject(new Error(`The calendar link answered HTTP ${status}`));
            }
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                size += Buffer.byteLength(chunk);
                if (size > exports.ICAL_MAX_BYTES) {
                    req.destroy(new Error('The calendar is too large'));
                    return;
                }
                data += chunk;
            });
            res.on('end', () => {
                if (!/BEGIN:VCALENDAR/i.test(data))
                    return reject(new Error('This link is not an iCal (.ics) calendar'));
                resolve(data);
            });
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('The calendar link timed out')));
        req.on('error', reject);
    });
}
function parseIcalDate(value) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!m)
        return null;
    const [, y, mo, d, h, mi, s] = m;
    const date = h ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(Date.UTC(+y, +mo - 1, +d));
    return isNaN(date.getTime()) ? null : date;
}
function parseIcalRanges(raw, keepAfter = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    const text = raw.replace(/\r?\n[ \t]/g, '');
    const out = [];
    const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
    for (const block of blocks.slice(0, 5000)) {
        const body = block.split(/END:VEVENT/i)[0];
        if (/^STATUS:CANCELLED/im.test(body))
            continue;
        const start = body.match(/^DTSTART[^:\r\n]*:(\S+)/im)?.[1];
        const end = body.match(/^DTEND[^:\r\n]*:(\S+)/im)?.[1];
        const from = start ? parseIcalDate(start) : null;
        let to = end ? parseIcalDate(end) : null;
        if (from && !to && start && start.length === 8)
            to = new Date(from.getTime() + 86_400_000);
        if (!from || !to || to <= from || to < keepAfter)
            continue;
        const summary = (body.match(/^SUMMARY[^:\r\n]*:(.*)$/im)?.[1] ?? '').trim().slice(0, 100);
        out.push({ from, to, reason: summary || 'External booking' });
    }
    return out;
}
const icsDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
const icsStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function buildIcalFeed(calendarName, events) {
    const now = icsStamp(new Date());
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//HoroHouse//Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${icsText(calendarName)}`,
    ];
    for (const e of events) {
        lines.push('BEGIN:VEVENT', `UID:${e.uid}@horohouse`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${icsDate(e.from)}`, `DTEND;VALUE=DATE:${icsDate(e.to)}`, `SUMMARY:${icsText(e.summary)}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
}
//# sourceMappingURL=ical.util.js.map