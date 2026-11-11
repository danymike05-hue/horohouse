"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const axios_1 = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const playwright_1 = require("playwright");
const property_schema_1 = require("./src/properties/schemas/property.schema");
const user_schema_1 = require("./src/users/schemas/user.schema");
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/horohouse';
const SCRAPE_COZYCOZY = process.env.SCRAPE_COZYCOZY !== 'false';
const SCRAPE_BOOKING = process.env.SCRAPE_BOOKING !== 'false';
const SCRAPE_AIRBNB = process.env.SCRAPE_AIRBNB !== 'false';
const SCRAPE_EXPEDIA = process.env.SCRAPE_EXPEDIA !== 'false';
const MAX_PAGES = parseInt(process.env.MAX_PAGES ?? '5', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';
const USD_TO_XAF = parseFloat(process.env.USD_TO_XAF ?? '610');
const OUTPUT_DIR = path.join(__dirname, 'scraped-data');
const DELAY_MS = 2500;
const DETAIL_DELAY_MS = 1800;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR))
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
function saveJson(filename, data) {
    const p = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`   💾 Saved → ${p}`);
}
function usdToXaf(usdStr) {
    const cleaned = String(usdStr).replace(/[^\d.]/g, '');
    const usd = parseFloat(cleaned);
    if (isNaN(usd) || usd <= 0)
        return 0;
    return Math.round(usd * USD_TO_XAF);
}
function parseXaf(raw) {
    const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? 0 : n;
}
function mapType(raw) {
    const s = (raw ?? '').toLowerCase();
    if (s.includes('villa'))
        return property_schema_1.PropertyType.VILLA;
    if (s.includes('studio'))
        return property_schema_1.PropertyType.STUDIO;
    if (s.includes('duplex'))
        return property_schema_1.PropertyType.DUPLEX;
    if (s.includes('bungalow'))
        return property_schema_1.PropertyType.BUNGALOW;
    if (s.includes('guesthouse') || s.includes('guest house') || s.includes('chambre d\'hôte'))
        return property_schema_1.PropertyType.GUESTHOUSE;
    if (s.includes('hostel'))
        return property_schema_1.PropertyType.HOSTEL;
    if (s.includes('resort'))
        return property_schema_1.PropertyType.RESORT;
    if (s.includes('hotel'))
        return property_schema_1.PropertyType.HOTEL;
    if (s.includes('house') || s.includes('maison'))
        return property_schema_1.PropertyType.HOUSE;
    if (s.includes('serviced'))
        return property_schema_1.PropertyType.SERVICED_APARTMENT;
    if (s.includes('apartment') || s.includes('appartement') || s.includes('flat'))
        return property_schema_1.PropertyType.APARTMENT;
    return property_schema_1.PropertyType.APARTMENT;
}
function cityToCountry(city) {
    const m = {
        douala: 'Cameroon', yaoundé: 'Cameroon', yaounde: 'Cameroon',
        bafoussam: 'Cameroon', kribi: 'Cameroon', garoua: 'Cameroon',
        bamenda: 'Cameroon', limbe: 'Cameroon',
        abidjan: "Côte d'Ivoire", yamoussoukro: "Côte d'Ivoire",
        dakar: 'Senegal', 'saint-louis': 'Senegal', thiès: 'Senegal',
    };
    return m[(city ?? '').toLowerCase()] ?? 'Cameroon';
}
function detectAmenities(text) {
    const t = (text ?? '').toLowerCase();
    return {
        hasWifi: /wifi|wi-fi|internet|connexion/.test(t),
        hasParking: /parking|park/.test(t),
        hasTv: /\btv\b|télévision|television|canal|netflix|screen/.test(t),
        hasKitchen: /kitchen|cuisine|kitchenette|réfrigérateur|fridge|micro/.test(t),
        hasAirConditioning: /air.con|climatisé|clim\b|ac\b/.test(t),
        hasPool: /pool|piscine/.test(t),
        hasBreakfast: /breakfast|petit.dej|petit-déj/.test(t),
        petsAllowed: /pet.friendly|animaux|pets allowed/.test(t),
        hasWasher: /washing machine|machine à laver|laveuse/.test(t),
        conciergeService: /concierge/.test(t),
        airportTransfer: /airport.transfer|navette.aéroport|airport shuttle/.test(t),
        selfCheckIn: /self.check.in|autonomous|autonome/.test(t),
    };
}
function extractCheckTimes(text) {
    const inMatch = (text ?? '').match(/check.in[^0-9]*(\d{1,2}[:h]\d{0,2})\s*(AM|PM|am|pm)?/i);
    const outMatch = (text ?? '').match(/check.out[^0-9]*(\d{1,2}[:h]\d{0,2})\s*(AM|PM|am|pm)?/i);
    return {
        checkInTime: inMatch ? inMatch[1].replace('h', ':').padEnd(5, '00') : '14:00',
        checkOutTime: outMatch ? outMatch[1].replace('h', ':').padEnd(5, '00') : '11:00',
    };
}
function inferCancellationPolicy(text) {
    const t = (text ?? '').toLowerCase();
    if (/no.refund|non.remboursable/.test(t))
        return property_schema_1.CancellationPolicy.NO_REFUND;
    if (/strict/.test(t))
        return property_schema_1.CancellationPolicy.STRICT;
    if (/moderate|modéré/.test(t))
        return property_schema_1.CancellationPolicy.MODERATE;
    return property_schema_1.CancellationPolicy.FLEXIBLE;
}
function safeDescription(...candidates) {
    for (const c of candidates) {
        const s = (c ?? '').trim();
        if (s.length >= 5)
            return s.slice(0, 2000);
    }
    return 'Short-term accommodation listing.';
}
async function fetchHtml(url) {
    const res = await axios_1.default.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 20000,
    });
    return res.data;
}
const COZYCOZY_URLS = [
    'https://www.cozycozy.com/us/cameroon-vacation-rentals',
    'https://www.cozycozy.com/us/cote-d-ivoire-vacation-rentals',
    'https://www.cozycozy.com/us/senegal-vacation-rentals',
];
async function scrapeCozyCozy() {
    console.log('\n🟢 CozyCoz scraper...');
    const results = [];
    for (const pageUrl of COZYCOZY_URLS) {
        console.log(`   📄 ${pageUrl}`);
        try {
            const html = await fetchHtml(pageUrl);
            const $ = cheerio.load(html);
            const cards = [];
            $('h3').each((_, el) => {
                const parent = $(el).closest('article, section, div[class*="card"], div[class*="item"], div[class*="listing"]');
                if (parent.length)
                    cards.push(parent);
            });
            console.log(`      → ${cards.length} cards found`);
            for (const card of cards) {
                const title = card.find('h3').first().text().trim();
                if (!title)
                    continue;
                const priceText = card.text().match(/\$[\d,]+(?:\.\d+)?(?:\s*\/\s*night)?/i)?.[0] ?? '';
                const priceXaf = priceText ? usdToXaf(priceText) : 0;
                if (priceXaf === 0)
                    continue;
                const typeCity = card.text().match(/([a-z\s]+)\s*,\s*([A-ZÀ-ÿa-z\s-]+)$/m);
                const rawType = typeCity?.[1]?.trim() ?? 'apartment';
                const rawCity = typeCity?.[2]?.trim() ?? '';
                const city = rawCity || 'Douala';
                const country = cityToCountry(city);
                const bedsText = card.text().match(/(\d+)\s+(\d+)\s*\n/);
                const bedrooms = bedsText ? parseInt(bedsText[1], 10) : 1;
                const bathrooms = bedsText ? parseInt(bedsText[2], 10) : 1;
                const ratingText = card.text().match(/(\d+\.\d+)\s*(?:\d+\s*reviews?)?/);
                const rawRating = ratingText ? parseFloat(ratingText[1]) : 0;
                const avgRating = rawRating > 5 ? rawRating / 2 : rawRating;
                const reviewText = card.text().match(/(\d+)\s*reviews?/i);
                const reviewCount = reviewText ? parseInt(reviewText[1], 10) : 0;
                const descFromP = card.find('p').filter((_, el) => $(el).text().length > 30).first().text().trim();
                const descFromAny = card.find('[class*="desc"], [class*="summary"]').first().text().trim();
                const description = safeDescription(descFromP, descFromAny, title, `${rawType} in ${city}`);
                const img = card.find('img').first();
                const imgUrl = img.attr('src') || img.attr('data-src') || img.attr('data-lazy') || '';
                const images = imgUrl ? [imgUrl] : [];
                const amenText = description + ' ' + title;
                const amenities = detectAmenities(amenText);
                const times = extractCheckTimes(amenText);
                results.push({
                    source: 'cozycozy',
                    sourceId: `cz-${Buffer.from(title + city).toString('base64').slice(0, 16)}`,
                    sourceUrl: pageUrl,
                    title,
                    description,
                    pricePerNight: priceXaf,
                    currency: 'XAF',
                    type: mapType(rawType),
                    city,
                    neighborhood: '',
                    address: city,
                    country,
                    bedrooms,
                    bathrooms,
                    maxGuests: Math.max(bedrooms * 2, 2),
                    area: null,
                    averageRating: Math.round(avgRating * 10) / 10,
                    reviewCount,
                    images,
                    ...amenities,
                    ...times,
                    cancellationPolicy: property_schema_1.CancellationPolicy.FLEXIBLE,
                    isInstantBookable: false,
                    scrapedAt: new Date().toISOString(),
                });
            }
            console.log(`      ✅ ${results.length} total so far`);
        }
        catch (err) {
            console.warn(`   ⚠️  ${pageUrl}: ${err.message}`);
        }
        await sleep(DELAY_MS);
    }
    console.log(`   ✅ CozyCoz: ${results.length} listings`);
    return results;
}
const BOOKING_SEARCH_URLS = [
    'https://www.booking.com/searchresults.html?ss=Douala&nflt=ht_id%3D220&rows=25',
    'https://www.booking.com/searchresults.html?ss=Yaounde&nflt=ht_id%3D220&rows=25',
    'https://www.booking.com/searchresults.html?ss=Kribi+Cameroon&nflt=ht_id%3D220&rows=25',
    'https://www.booking.com/searchresults.html?ss=Douala&nflt=ht_id%3D204&rows=25',
    'https://www.booking.com/searchresults.html?ss=Abidjan&nflt=ht_id%3D220&rows=25',
    'https://www.booking.com/searchresults.html?ss=Dakar&nflt=ht_id%3D220&rows=25',
];
async function scrapeBookingSearchPagePW(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('[data-testid="property-card"], .sr_property_block, a[href*="/hotel/"]', {
            timeout: 15000,
        }).catch(() => { });
        await page.waitForTimeout(2000);
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href*="/hotel/"]'))
                .map(a => {
                const href = a.href;
                return href.split('?')[0].split('#')[0];
            })
                .filter(href => /booking\.com\/hotel\/[a-z]{2}\/[^/]+\.html$/.test(href));
        });
        return [...new Set(links)];
    }
    catch (err) {
        console.warn(`   ⚠️  Booking search failed: ${err.message}`);
        return [];
    }
}
async function scrapeBookingDetailPW(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2000);
        const data = await page.evaluate(() => {
            const pageText = document.body.innerText ?? '';
            const title = document.querySelector('h2[itemprop="name"], h1, [data-testid="property-header-name"]')?.innerText?.trim() ?? '';
            const address = document.querySelector('[itemprop="streetAddress"], [data-testid="address"], span[class*="address"]')?.innerText?.trim() ?? '';
            const ratingEl = document.querySelector('[class*="review-score__badge"], [class*="rating-badge"], [data-testid="review-score-right-component"]');
            const ratingText = ratingEl?.innerText?.trim() ?? '';
            let description = '';
            document.querySelectorAll('[class*="description"], [class*="summary"], [itemprop="description"], p').forEach(el => {
                const t = el.innerText?.trim() ?? '';
                if (t.length > description.length)
                    description = t;
            });
            const amenityText = Array.from(document.querySelectorAll('[class*="facilitie"], [class*="amenities"]'))
                .map(el => el.innerText).join(' ');
            const imgs = [];
            document.querySelectorAll('img[src*="bstatic.com"], img[src*="booking.com/hotel"]').forEach(el => {
                const src = el.src || el.getAttribute('data-src') || '';
                const hires = src.replace(/max\d+/, 'max1024').replace(/square\d+/, 'max1024');
                if (hires && !imgs.includes(hires) && !hires.includes('logo'))
                    imgs.push(hires);
            });
            return { title, address, ratingText, description, amenityText, pageText: pageText.slice(0, 5000), imgs: imgs.slice(0, 10) };
        });
        if (!data.title)
            return null;
        const ccMatch = url.match(/\/hotel\/([a-z]{2})\//);
        const cc = ccMatch?.[1] ?? 'cm';
        const ccToCountry = {
            cm: 'Cameroon', ci: "Côte d'Ivoire", sn: 'Senegal', ga: 'Gabon',
        };
        const country = ccToCountry[cc] ?? 'Cameroon';
        const rawRating = parseFloat(data.ratingText) || 0;
        const avgRating = rawRating > 5 ? Math.round((rawRating / 2) * 10) / 10 : rawRating;
        const reviewMatch = data.pageText.match(/(\d+)\s*(?:reviews?|avis)/i);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[1], 10) : 0;
        const bedsMatch = data.pageText.match(/(\d+)\s*(?:separate\s*)?bedroom/i) || data.pageText.match(/(\d+)\s*chambre/i);
        const bathsMatch = data.pageText.match(/(\d+)\s*(?:full\s*)?bathroom/i) || data.pageText.match(/(\d+)\s*salle/i);
        const areaMatch = data.pageText.match(/(\d+)\s*(?:ft²|sq\s*ft)/i);
        const bedrooms = bedsMatch ? parseInt(bedsMatch[1], 10) : 1;
        const bathrooms = bathsMatch ? parseInt(bathsMatch[1], 10) : 1;
        const area = areaMatch ? Math.round(parseInt(areaMatch[1], 10) * 0.0929) : null;
        const guestMatch = data.pageText.match(/(?:up to|accommodate[sd]?|max\.?\s*)(\d+)\s*guests?/i);
        const maxGuests = guestMatch ? parseInt(guestMatch[1], 10) : Math.max(bedrooms * 2, 2);
        let pricePerNight = 0;
        const xafMatch = data.pageText.match(/([\d\s]+)\s*XAF\s*(?:per\s*night|\/\s*night|nuit)/i);
        const usdMatch = data.pageText.match(/\$([\d,]+(?:\.\d+)?)\s*(?:per\s*night|\/\s*night)/i);
        if (xafMatch)
            pricePerNight = parseXaf(xafMatch[1]);
        else if (usdMatch)
            pricePerNight = usdToXaf(usdMatch[1]);
        const cityMatch = (data.address + data.pageText).match(/(?:in|à|dans)\s+([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s[A-ZÀ-ÿ][a-zà-ÿ]+)?)/);
        const city = cityMatch?.[1] ?? (cc === 'cm' ? 'Douala' : cc === 'ci' ? 'Abidjan' : 'Dakar');
        const sourceId = url.split('/').pop()?.replace('.html', '') ?? url;
        const amenText = data.amenityText + ' ' + data.description + ' ' + data.pageText.slice(0, 2000);
        const amenities = detectAmenities(amenText);
        const times = extractCheckTimes(data.pageText);
        const type = mapType(data.title);
        const description = safeDescription(data.description, `${type} in ${city}`, data.title);
        return {
            source: 'booking',
            sourceId,
            sourceUrl: url,
            title: data.title,
            description,
            pricePerNight,
            currency: 'XAF',
            type,
            city,
            neighborhood: '',
            address: data.address || city,
            country,
            bedrooms,
            bathrooms,
            maxGuests,
            area,
            averageRating: avgRating,
            reviewCount,
            images: data.imgs,
            ...amenities,
            ...times,
            cancellationPolicy: inferCancellationPolicy(data.pageText),
            isInstantBookable: /no credit card|sans carte/i.test(data.pageText),
            scrapedAt: new Date().toISOString(),
        };
    }
    catch (err) {
        console.warn(`   ⚠️  Booking detail failed ${url}: ${err.message}`);
        return null;
    }
}
async function scrapeBooking(browser) {
    console.log('\n🔵 Booking.com scraper (Playwright)...');
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        locale: 'fr-FR',
    });
    const page = await context.newPage();
    const allLinks = [];
    const searchUrls = BOOKING_SEARCH_URLS.slice(0, MAX_PAGES);
    for (const searchUrl of searchUrls) {
        console.log(`   📄 ${searchUrl}`);
        const links = await scrapeBookingSearchPagePW(page, searchUrl);
        links.forEach(l => { if (!allLinks.includes(l))
            allLinks.push(l); });
        console.log(`      → ${links.length} links (total: ${allLinks.length})`);
        await sleep(DELAY_MS);
    }
    const results = [];
    const toScrape = allLinks.slice(0, MAX_PAGES * 25);
    console.log(`   📋 Scraping ${toScrape.length} Booking.com pages...`);
    for (let i = 0; i < toScrape.length; i++) {
        process.stdout.write(`   [${i + 1}/${toScrape.length}] ${toScrape[i].split('/').pop()?.slice(0, 40)}... `);
        const listing = await scrapeBookingDetailPW(page, toScrape[i]);
        if (listing && listing.pricePerNight > 0) {
            results.push(listing);
            console.log(`✅ ${listing.city} — ${listing.pricePerNight.toLocaleString()} XAF/night`);
        }
        else {
            console.log(`⏭  skipped (no price or parse failed)`);
        }
        await sleep(DETAIL_DELAY_MS);
    }
    await context.close();
    console.log(`   ✅ Booking.com: ${results.length} listings`);
    return results;
}
const AIRBNB_SEARCH_URLS = [
    'https://www.airbnb.com/s/Douala--Cameroon/homes',
    'https://www.airbnb.com/s/Yaound%C3%A9--Cameroon/homes',
    'https://www.airbnb.com/s/Abidjan--Ivory-Coast/homes',
    'https://www.airbnb.com/s/Dakar--Senegal/homes',
    'https://www.airbnb.com/s/Kribi--Cameroon/homes',
];
async function scrapeAirbnb(browser) {
    console.log('\n🟠 Airbnb scraper (Playwright)...');
    const results = [];
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        locale: 'fr-FR',
    });
    const page = await context.newPage();
    const allDetailUrls = [];
    const searchUrls = AIRBNB_SEARCH_URLS.slice(0, Math.min(AIRBNB_SEARCH_URLS.length, MAX_PAGES));
    for (const searchUrl of searchUrls) {
        console.log(`   📄 ${searchUrl}`);
        try {
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForSelector('a[href*="/rooms/"]', { timeout: 15000 }).catch(() => { });
            await page.waitForTimeout(3000);
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a[href*="/rooms/"]'))
                    .map(a => a.href.split('?')[0])
                    .filter(href => /airbnb\.(com|fr)\/rooms\/\d+/.test(href));
            });
            const unique = [...new Set(links)].filter(l => !allDetailUrls.includes(l));
            allDetailUrls.push(...unique);
            console.log(`      → ${unique.length} new links (total: ${allDetailUrls.length})`);
        }
        catch (err) {
            console.warn(`   ⚠️  ${searchUrl}: ${err.message}`);
        }
        await sleep(DELAY_MS);
    }
    const toScrape = allDetailUrls.slice(0, MAX_PAGES * 20);
    console.log(`   📋 Scraping ${toScrape.length} Airbnb listing pages...`);
    for (let i = 0; i < toScrape.length; i++) {
        const url = toScrape[i];
        process.stdout.write(`   [${i + 1}/${toScrape.length}] Airbnb ${url.split('/').pop()}... `);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2500);
            const data = await page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                let jsonLd = null;
                for (const script of scripts) {
                    try {
                        const parsed = JSON.parse(script.textContent ?? '');
                        if (parsed.name && (parsed.priceSpecification || parsed.offers)) {
                            jsonLd = parsed;
                            break;
                        }
                    }
                    catch { }
                }
                const pageText = document.body.innerText?.slice(0, 5000) ?? '';
                const imgs = [];
                document.querySelectorAll('img[data-original-uri], img[src*="muscache.com"]').forEach(img => {
                    const src = img.getAttribute('data-original-uri') || img.src;
                    if (src && !imgs.includes(src) && !src.includes('profile_pic') && !src.includes('avatar')) {
                        imgs.push(src);
                    }
                });
                const amenityText = Array.from(document.querySelectorAll('[class*="amenity"], [class*="feature"]'))
                    .map(el => el.textContent).join(' ');
                return { jsonLd, pageText, imgs: imgs.slice(0, 10), amenityText };
            });
            const ld = data.jsonLd ?? {};
            const title = ld.name || data.pageText.split('\n')[0]?.trim() || 'Airbnb listing';
            const rawPrice = ld.priceSpecification?.price || ld.offers?.price || 0;
            const pricePerNight = rawPrice > 0 ? usdToXaf(String(rawPrice)) : 0;
            if (pricePerNight === 0) {
                console.log(`⏭  no price`);
                continue;
            }
            const addr = ld.address ?? {};
            const city = addr.addressLocality || data.pageText.match(/([A-ZÀ-ÿ][a-zà-ÿ]+),\s*(?:Cameroon|Côte|Senegal|Cameroun)/)?.[1] || 'Douala';
            const country = addr.addressCountry || cityToCountry(city);
            const address = [addr.streetAddress, city].filter(Boolean).join(', ');
            const ratingVal = ld.starRating?.ratingValue || ld.aggregateRating?.ratingValue || 0;
            const avgRating = Math.min(5, parseFloat(String(ratingVal)) || 0);
            const reviewCount = ld.aggregateRating?.reviewCount || 0;
            const bedsMatch = data.pageText.match(/(\d+)\s*(?:bedroom|chambre)/i);
            const bathsMatch = data.pageText.match(/(\d+)\s*(?:bathroom|salle\s*de\s*bain)/i);
            const guestMatch = data.pageText.match(/(\d+)\s*guests?/i);
            const bedrooms = bedsMatch ? parseInt(bedsMatch[1], 10) : 1;
            const bathrooms = bathsMatch ? parseInt(bathsMatch[1], 10) : 1;
            const maxGuests = guestMatch ? parseInt(guestMatch[1], 10) : Math.max(bedrooms * 2, 2);
            const amenText = data.amenityText + ' ' + (ld.description ?? '') + ' ' + data.pageText.slice(0, 2000);
            const amenities = detectAmenities(amenText);
            const times = extractCheckTimes(data.pageText);
            const type = mapType(ld['@type'] || title);
            const description = safeDescription(ld.description, `${type} in ${city}`, title);
            results.push({
                source: 'airbnb',
                sourceId: url.split('/rooms/')[1]?.split('?')[0] ?? url,
                sourceUrl: url,
                title,
                description,
                pricePerNight,
                currency: 'XAF',
                type,
                city,
                neighborhood: addr.addressRegion || '',
                address,
                country,
                bedrooms,
                bathrooms,
                maxGuests,
                area: null,
                averageRating: avgRating,
                reviewCount,
                images: data.imgs,
                ...amenities,
                ...times,
                cancellationPolicy: inferCancellationPolicy(data.pageText),
                isInstantBookable: /instant book|réservation instantanée/i.test(data.pageText),
                scrapedAt: new Date().toISOString(),
            });
            console.log(`✅ ${city} — ${pricePerNight.toLocaleString()} XAF/night`);
        }
        catch (err) {
            console.warn(`⚠️  ${err.message}`);
        }
        await sleep(DETAIL_DELAY_MS);
    }
    await context.close();
    console.log(`   ✅ Airbnb: ${results.length} listings`);
    return results;
}
const EXPEDIA_URLS = [
    'https://www.expedia.com/Douala-Hotels.d6091073.Travel-Guide-Hotels',
    'https://www.expedia.com/Yaounde-Hotels.d6139065.Travel-Guide-Hotels',
    'https://www.expedia.com/Abidjan-Hotels.d178270.Travel-Guide-Hotels',
    'https://www.expedia.com/Dakar-Hotels.d178316.Travel-Guide-Hotels',
    'https://www.expedia.com/Kribi-Hotels.d6139073.Travel-Guide-Hotels',
];
async function scrapeExpedia() {
    console.log('\n🟡 Expedia scraper (replaces Jumia Travel)...');
    const results = [];
    for (const pageUrl of EXPEDIA_URLS.slice(0, MAX_PAGES)) {
        console.log(`   📄 ${pageUrl}`);
        try {
            const html = await fetchHtml(pageUrl);
            const $ = cheerio.load(html);
            $('[itemprop="itemListElement"], [data-stid="property-listing"], article').each((_, el) => {
                const card = $(el);
                const title = card.find('[itemprop="name"], h3, h2, [class*="title"]').first().text().trim();
                if (!title)
                    return;
                const priceText = card.find('[data-stid="price-summary"], [class*="price"]').first().text().trim();
                let pricePerNight = 0;
                if (/XAF/.test(priceText))
                    pricePerNight = parseXaf(priceText);
                else if (/\$/.test(priceText))
                    pricePerNight = usdToXaf(priceText);
                if (pricePerNight === 0)
                    return;
                const cityRaw = pageUrl.match(/expedia\.com\/([A-Za-z-]+)-Hotels/)?.[1]?.replace(/-/g, ' ') ?? 'Douala';
                const city = cityRaw.charAt(0).toUpperCase() + cityRaw.slice(1).toLowerCase();
                const country = cityToCountry(city);
                const ratingText = card.find('[class*="rating"], [itemprop="ratingValue"], [class*="score"]').first().text().trim()
                    || card.find('[aria-label*="out of"]').first().attr('aria-label') || '';
                const rawRating = parseFloat(ratingText) || 0;
                const avgRating = rawRating > 5 ? rawRating / 2 : rawRating;
                const starText = card.find('[class*="star"], [itemprop="starRating"]').text();
                const starMatch = starText.match(/(\d)/);
                const stars = starMatch ? Math.min(5, parseInt(starMatch[1], 10)) : undefined;
                const descFromCard = card.find('p, [class*="desc"]').filter((_, e) => $(e).text().length > 20).first().text().trim();
                const type = stars && stars >= 4 ? property_schema_1.PropertyType.HOTEL : property_schema_1.PropertyType.GUESTHOUSE;
                const description = safeDescription(descFromCard, `${stars ?? 3}-star hotel in ${city}`, title);
                const imgSrc = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || '';
                const images = imgSrc ? [imgSrc] : [];
                const amenText = card.text() + ' ' + description;
                const amenities = detectAmenities(amenText);
                const times = extractCheckTimes(amenText);
                results.push({
                    source: 'expedia',
                    sourceId: `ex-${Buffer.from(title + city).toString('base64').slice(0, 16)}`,
                    sourceUrl: pageUrl,
                    title,
                    description,
                    pricePerNight,
                    currency: 'XAF',
                    type,
                    city,
                    neighborhood: '',
                    address: city,
                    country,
                    bedrooms: 1,
                    bathrooms: 1,
                    maxGuests: 2,
                    area: null,
                    averageRating: Math.round(avgRating * 10) / 10,
                    reviewCount: 0,
                    images,
                    starRating: stars,
                    ...amenities,
                    ...times,
                    cancellationPolicy: property_schema_1.CancellationPolicy.FLEXIBLE,
                    isInstantBookable: false,
                    scrapedAt: new Date().toISOString(),
                });
            });
            console.log(`      → Total so far: ${results.length}`);
        }
        catch (err) {
            console.warn(`   ⚠️  ${pageUrl}: ${err.message}`);
        }
        await sleep(DELAY_MS);
    }
    console.log(`   ✅ Expedia: ${results.length} listings`);
    return results;
}
async function importStaysToMongo(stays, ownerId) {
    const PropertyModel = mongoose_1.default.model('Property', property_schema_1.PropertySchema);
    let inserted = 0;
    let skipped = 0;
    for (const stay of stays) {
        if (stay.pricePerNight <= 0) {
            skipped++;
            continue;
        }
        if (!stay.description || stay.description.trim().length < 5) {
            stay.description = safeDescription(stay.title, `${stay.type} in ${stay.city}`);
        }
        const exists = await PropertyModel.findOne({ slug: stay.sourceUrl });
        if (exists) {
            skipped++;
            continue;
        }
        const images = stay.images.map((url, i) => ({
            url,
            publicId: `scraped/stays/${stay.source}/${stay.sourceId}_${i}`,
            caption: i === 0 ? 'Vue principale' : 'Photo',
            isMain: i === 0,
        }));
        await PropertyModel.create({
            title: stay.title,
            slug: stay.sourceUrl,
            description: stay.description,
            price: stay.pricePerNight,
            currency: 'XAF',
            type: stay.type,
            listingType: property_schema_1.ListingType.SHORT_TERM,
            pricingUnit: property_schema_1.PricingUnit.NIGHTLY,
            city: stay.city,
            neighborhood: stay.neighborhood,
            address: stay.address,
            country: stay.country,
            location: { type: 'Point', coordinates: [0, 0] },
            images,
            amenities: {
                bedrooms: stay.bedrooms,
                bathrooms: stay.bathrooms,
                hasAirConditioning: stay.hasAirConditioning,
                hasInternet: stay.hasWifi,
                hasPool: stay.hasPool,
                furnished: true,
            },
            shortTermAmenities: {
                hasWifi: stay.hasWifi,
                hasBreakfast: stay.hasBreakfast,
                hasParking: stay.hasParking,
                hasTv: stay.hasTv,
                hasKitchen: stay.hasKitchen,
                hasAirConditioning: stay.hasAirConditioning,
                hasWasher: stay.hasWasher,
                petsAllowed: stay.petsAllowed,
                maxGuests: stay.maxGuests,
                checkInTime: stay.checkInTime,
                checkOutTime: stay.checkOutTime,
                selfCheckIn: stay.selfCheckIn,
                conciergeService: stay.conciergeService,
                airportTransfer: stay.airportTransfer,
                smokingAllowed: false,
                partiesAllowed: false,
            },
            minNights: 1,
            maxNights: 365,
            cleaningFee: 0,
            serviceFee: 0,
            weeklyDiscountPercent: 10,
            monthlyDiscountPercent: 15,
            isInstantBookable: stay.isInstantBookable,
            cancellationPolicy: stay.cancellationPolicy,
            advanceNoticeDays: 1,
            bookingWindowDays: 365,
            unavailableDates: [],
            area: stay.area ?? undefined,
            ...(stay.starRating && stay.starRating >= 1 && stay.starRating <= 5
                ? { starRating: stay.starRating }
                : {}),
            availability: property_schema_1.PropertyStatus.ACTIVE,
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
            isVerified: false,
            isFeatured: false,
            isActive: true,
            averageRating: stay.averageRating,
            reviewCount: stay.reviewCount,
            viewsCount: 0,
            inquiriesCount: 0,
            favoritesCount: 0,
            sharesCount: 0,
            ownerId,
            keywords: [stay.city, stay.type, 'short_term', stay.country.toLowerCase(), 'séjour', 'location courte durée'],
            isStudentFriendly: false,
            studentDetails: undefined,
            tourType: 'none',
            tourViews: 0,
        });
        inserted++;
    }
    return { inserted, skipped };
}
async function main() {
    console.log('🌍 HoroHouse Short-Term Stay Scraper');
    console.log(`   CozyCoz  : ${SCRAPE_COZYCOZY}`);
    console.log(`   Booking  : ${SCRAPE_BOOKING}`);
    console.log(`   Airbnb   : ${SCRAPE_AIRBNB}`);
    console.log(`   Expedia  : ${SCRAPE_EXPEDIA}`);
    console.log(`   Max pages: ${MAX_PAGES}`);
    console.log(`   Rate     : 1 USD = ${USD_TO_XAF} XAF`);
    console.log(`   Dry run  : ${DRY_RUN}`);
    console.log('');
    ensureOutputDir();
    const allStays = [];
    let browser = null;
    if (SCRAPE_BOOKING || SCRAPE_AIRBNB) {
        browser = await playwright_1.chromium.launch({ headless: true, args: ['--no-sandbox'] });
    }
    try {
        if (SCRAPE_COZYCOZY) {
            const r = await scrapeCozyCozy();
            allStays.push(...r);
            saveJson(`cozycozy-stays-${Date.now()}.json`, r);
        }
        if (SCRAPE_BOOKING && browser) {
            const r = await scrapeBooking(browser);
            allStays.push(...r);
            saveJson(`booking-stays-${Date.now()}.json`, r);
        }
        if (SCRAPE_AIRBNB && browser) {
            const r = await scrapeAirbnb(browser);
            allStays.push(...r);
            saveJson(`airbnb-stays-${Date.now()}.json`, r);
        }
        if (SCRAPE_EXPEDIA) {
            const r = await scrapeExpedia();
            allStays.push(...r);
            saveJson(`expedia-stays-${Date.now()}.json`, r);
        }
    }
    finally {
        if (browser)
            await browser.close();
    }
    saveJson(`all-stays-${Date.now()}.json`, allStays);
    console.log(`\n📊 Total stays scraped: ${allStays.length}`);
    const bySource = allStays.reduce((acc, s) => {
        acc[s.source] = (acc[s.source] ?? 0) + 1;
        return acc;
    }, {});
    Object.entries(bySource).forEach(([src, n]) => console.log(`   ${src.padEnd(12)} ${n}`));
    if (DRY_RUN) {
        console.log('\n⚡ Dry run — skipping MongoDB import.');
        return;
    }
    if (allStays.length === 0) {
        console.log('\n⚠️  Nothing to import.');
        return;
    }
    console.log('\n📥 Connecting to MongoDB...');
    await mongoose_1.default.connect(MONGO_URI);
    console.log('✅ Connected');
    const UserModel = mongoose_1.default.model('User', user_schema_1.UserSchema);
    const admin = await UserModel.findOne({ role: user_schema_1.UserRole.ADMIN });
    if (!admin)
        throw new Error('No admin user found. Run seed.ts first.');
    const ownerId = admin._id;
    console.log(`👤 Owner: ${admin.name}`);
    console.log('\n📥 Importing stays to MongoDB...');
    const { inserted, skipped } = await importStaysToMongo(allStays, ownerId);
    console.log(`\n🎉 Import complete!`);
    console.log(`   ✅ Inserted : ${inserted}`);
    console.log(`   ⏭  Skipped  : ${skipped} (duplicates / invalid price)`);
    console.log(`   📁 JSON backup: ${OUTPUT_DIR}`);
    await mongoose_1.default.disconnect();
}
main().catch(err => {
    console.error('\n❌ Scraper failed:', err.message);
    process.exit(1);
});
//# sourceMappingURL=scraper-stays.js.map