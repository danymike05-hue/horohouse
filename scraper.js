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
const SCRAPE_IMMOOZ = process.env.SCRAPE_IMMOOZ !== 'false';
const SCRAPE_MAPIOLE = process.env.SCRAPE_MAPIOLE !== 'false';
const MAX_PAGES = parseInt(process.env.MAX_PAGES ?? '5', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';
const OUTPUT_DIR = path.join(__dirname, 'scraped-data');
const DELAY_MS = 2000;
const DETAIL_DELAY_MS = 1500;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR))
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
function saveJson(filename, data) {
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`   💾 Saved → ${filepath}`);
}
function parseListingType(raw) {
    const s = raw.toLowerCase();
    if (s.includes('vente') || s.includes('vendre') || s.includes('achat') || s.includes('sale'))
        return property_schema_1.ListingType.SALE;
    if (s.includes('court') || s.includes('vacation') || s.includes('nuit') || s.includes('short'))
        return property_schema_1.ListingType.SHORT_TERM;
    return property_schema_1.ListingType.RENT;
}
function parsePropertyType(raw) {
    const s = raw.toLowerCase();
    if (s.includes('villa'))
        return property_schema_1.PropertyType.VILLA;
    if (s.includes('studio'))
        return property_schema_1.PropertyType.STUDIO;
    if (s.includes('duplex'))
        return property_schema_1.PropertyType.DUPLEX;
    if (s.includes('appartement') || s.includes('apartment'))
        return property_schema_1.PropertyType.APARTMENT;
    if (s.includes('terrain') || s.includes('land'))
        return property_schema_1.PropertyType.LAND;
    if (s.includes('bureau') || s.includes('office'))
        return property_schema_1.PropertyType.OFFICE;
    if (s.includes('commercial') || s.includes('local'))
        return property_schema_1.PropertyType.COMMERCIAL;
    if (s.includes('bungalow'))
        return property_schema_1.PropertyType.BUNGALOW;
    if (s.includes('maison') || s.includes('house'))
        return property_schema_1.PropertyType.HOUSE;
    if (s.includes('entrepôt') || s.includes('warehouse'))
        return property_schema_1.PropertyType.WAREHOUSE;
    return property_schema_1.PropertyType.HOUSE;
}
function parsePrice(raw) {
    const cleaned = raw.replace(/[^\d]/g, '');
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? 0 : n;
}
function parseCity(raw) {
    const cities = ['Douala', 'Yaoundé', 'Yaounde', 'Bafoussam', 'Kribi', 'Garoua', 'Bamenda',
        'Abidjan', 'Dakar', 'Lomé', 'Cotonou', 'Libreville'];
    for (const city of cities) {
        if (raw.toLowerCase().includes(city.toLowerCase()))
            return city === 'Yaounde' ? 'Yaoundé' : city;
    }
    const parts = raw.split(',').map(p => p.trim());
    return parts[parts.length - 1] || raw;
}
function parseCountry(city) {
    const map = {
        'Douala': 'Cameroon', 'Yaoundé': 'Cameroon', 'Bafoussam': 'Cameroon',
        'Kribi': 'Cameroon', 'Garoua': 'Cameroon', 'Bamenda': 'Cameroon',
        'Abidjan': "Côte d'Ivoire",
        'Dakar': 'Senegal',
        'Lomé': 'Togo',
        'Cotonou': 'Bénin',
        'Libreville': 'Gabon',
    };
    return map[city] ?? 'Cameroon';
}
const IMMOOZ_BASE = 'https://immooz.com/cm';
const IMMOOZ_SECTIONS = [
    `${IMMOOZ_BASE}/louer/`,
    `${IMMOOZ_BASE}/acheter/`,
    `${IMMOOZ_BASE}/louer/appartement-a-louer/`,
    `${IMMOOZ_BASE}/louer/villa-a-louer/`,
    `${IMMOOZ_BASE}/louer/bureau-a-louer/`,
    `${IMMOOZ_BASE}/acheter/terrain-a-vendre/`,
    `${IMMOOZ_BASE}/acheter/villa-a-vendre/`,
    `${IMMOOZ_BASE}/acheter/appartement-a-acheter/`,
];
async function fetchHtml(url) {
    const response = await axios_1.default.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000,
    });
    return response.data;
}
function extractImmoozLinks(html) {
    const $ = cheerio.load(html);
    const links = [];
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const full = href.startsWith('http') ? href : `https://immooz.com${href}`;
        if (!full.includes('immooz.com/cm/'))
            return;
        const excluded = [
            '/louer/', '/acheter/', '/barometre', '/estimer', '/journal',
            '/poster-annonce', '/auth/', '/mentions', '/cgu', '/confidentialite',
            '/cookies', '/nous-contacter', '/annonceur/', '/immobilier/',
        ];
        if (excluded.some(ex => full.includes(ex) && full.split('/').filter(Boolean).length < 7))
            return;
        const pathParts = full.replace('https://immooz.com', '').split('/').filter(Boolean);
        if (pathParts.length < 5)
            return;
        const lastSegment = pathParts[pathParts.length - 1];
        if (!/\-\d+$/.test(lastSegment))
            return;
        if (!links.includes(full))
            links.push(full);
    });
    return links;
}
async function scrapeImmoozDetail(url) {
    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const lastSegment = url.split('/').filter(Boolean).pop() ?? '';
        const idMatch = lastSegment.match(/\-(\d+)$/);
        const sourceId = idMatch ? idMatch[1] : lastSegment;
        const title = $('h1').first().text().trim() || 'Annonce immobilière';
        const pageText = $('body').text();
        const priceMatch = pageText.match(/([\d\s]+)\s*XAF/);
        const price = priceMatch ? parsePrice(priceMatch[1]) : 0;
        const description = $('h2').filter((_, el) => $(el).text().trim() === 'Description')
            .next('p').text().trim()
            || $('p').filter((_, el) => $(el).text().length > 40).first().text().trim()
            || title;
        const pathParts = url.replace('https://immooz.com/cm/', '').split('/').filter(Boolean);
        const urlCity = pathParts[2] ?? '';
        const urlNeigh = pathParts[3] === 'x' ? '' : (pathParts[3] ?? '');
        const urlAction = pathParts[0] ?? '';
        const urlType = pathParts[1] ?? '';
        const locationLine = $('h1').first().next().text().trim();
        const city = parseCity(locationLine || urlCity);
        const neighborhood = urlNeigh || locationLine.split(',')[0]?.trim() || '';
        const country = parseCountry(city);
        const listingType = urlAction === 'louer' ? property_schema_1.ListingType.RENT
            : urlAction === 'acheter' ? property_schema_1.ListingType.SALE
                : property_schema_1.ListingType.RENT;
        const type = parsePropertyType(urlType || title);
        const bedsMatch = pageText.match(/(\d+)\s*(?:chambre|bedroom)/i);
        const bathsMatch = pageText.match(/(\d+)\s*(?:salle de bain|douche|bathroom)/i);
        const areaMatch = pageText.match(/(\d+)\s*m[²2]/i);
        const bedrooms = bedsMatch ? parseInt(bedsMatch[1], 10) : 0;
        const bathrooms = bathsMatch ? parseInt(bathsMatch[1], 10) : 0;
        const area = areaMatch ? parseInt(areaMatch[1], 10) : null;
        const images = [];
        $('img').each((_, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src') || '';
            if (!src)
                return;
            const full = src.startsWith('http') ? src : `https://immooz.com${src}`;
            if (full.includes('/storage/annonces/') &&
                !images.includes(full))
                images.push(full);
        });
        let contactPhone = '';
        $('a[href*="wa.me"], a[href*="tel:"]').each((_, el) => {
            const href = $(el).attr('href') ?? '';
            const numMatch = href.match(/(\+?237[\d]+|[\d]{8,9})/);
            if (numMatch && !contactPhone)
                contactPhone = numMatch[1];
        });
        if (!contactPhone) {
            const telMatch = pageText.match(/\+237[\s]?[\d]{8,9}/);
            contactPhone = telMatch ? telMatch[0] : '';
        }
        return {
            source: 'immooz',
            sourceId,
            sourceUrl: url,
            title,
            description: description.slice(0, 2000),
            price,
            currency: 'XAF',
            listingType,
            type,
            city,
            neighborhood,
            address: `${neighborhood ? neighborhood + ', ' : ''}${city}, Cameroun`,
            country,
            bedrooms,
            bathrooms,
            area,
            images: images.slice(0, 10),
            contactPhone,
            scrapedAt: new Date().toISOString(),
        };
    }
    catch (err) {
        console.warn(`   ⚠️  Failed to scrape ${url}: ${err.message}`);
        return null;
    }
}
async function runImmoozScraper() {
    console.log('\n🔵 Starting Immooz scraper...');
    const allLinks = [];
    const sectionsToScrape = IMMOOZ_SECTIONS.slice(0, Math.min(IMMOOZ_SECTIONS.length, MAX_PAGES * 2));
    for (const sectionUrl of sectionsToScrape) {
        console.log(`   📄 Section: ${sectionUrl}`);
        try {
            const html = await fetchHtml(sectionUrl);
            const links = extractImmoozLinks(html);
            const newLinks = links.filter(l => !allLinks.includes(l));
            allLinks.push(...newLinks);
            console.log(`      → Found ${newLinks.length} new links (total: ${allLinks.length})`);
        }
        catch (err) {
            console.warn(`   ⚠️  Failed to load ${sectionUrl}: ${err.message}`);
        }
        await sleep(DELAY_MS);
    }
    const cap = MAX_PAGES * 20;
    const toScrape = allLinks.slice(0, cap);
    console.log(`   📋 Total Immooz listings to scrape: ${toScrape.length}`);
    const results = [];
    for (let i = 0; i < toScrape.length; i++) {
        const url = toScrape[i];
        process.stdout.write(`   [${i + 1}/${toScrape.length}] Scraping... `);
        const prop = await scrapeImmoozDetail(url);
        if (prop && prop.price > 0) {
            results.push(prop);
            console.log(`✅ ${prop.title.slice(0, 55)}`);
        }
        else {
            console.log(`⏭  skipped (no price)`);
        }
        await sleep(DETAIL_DELAY_MS);
    }
    console.log(`\n   ✅ Immooz: ${results.length} properties scraped`);
    return results;
}
const MAPIOLE_BASE = 'https://www.mapiole.com';
const MAPIOLE_LISTING_URLS = [
    `${MAPIOLE_BASE}/product-listing`,
    `${MAPIOLE_BASE}/product-listing?propertyType[]=Apartment`,
    `${MAPIOLE_BASE}/product-listing?propertyType[]=House`,
    `${MAPIOLE_BASE}/product-listing?propertyType[]=Land`,
    `${MAPIOLE_BASE}/product-listing?propertyType[]=Commercial`,
    `${MAPIOLE_BASE}/product-listing?propertyType[]=Villa`,
];
async function runMapioleScraper() {
    console.log('\n🟡 Starting Mapiole scraper (Playwright)...');
    const results = [];
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        locale: 'fr-FR',
        extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
    });
    const page = await context.newPage();
    const allDetailUrls = [];
    const pagesToVisit = MAPIOLE_LISTING_URLS.slice(0, MAX_PAGES);
    for (const listingUrl of pagesToVisit) {
        console.log(`   📄 Mapiole: ${listingUrl}`);
        try {
            await page.goto(listingUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(3000);
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
            const links = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                return anchors
                    .map(a => a.href)
                    .filter(href => href.includes('/product/') ||
                    href.includes('/property/') ||
                    href.includes('/listing/') ||
                    href.includes('/bien/') ||
                    /mapiole\.com\/\d+/.test(href));
            });
            const unique = [...new Set(links)].filter(l => !allDetailUrls.includes(l));
            allDetailUrls.push(...unique);
            console.log(`      → Found ${unique.length} new links (total: ${allDetailUrls.length})`);
        }
        catch (err) {
            console.warn(`   ⚠️  Failed to load ${listingUrl}: ${err.message}`);
        }
        await sleep(DELAY_MS);
    }
    if (allDetailUrls.length === 0) {
        console.log('   ℹ️  No links found via DOM — attempting API response interception...');
        const interceptedUrls = [];
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/') && url.includes('product') || url.includes('listing')) {
                try {
                    const json = await response.json();
                    const text = JSON.stringify(json);
                    const ids = text.match(/"id"\s*:\s*(\d+)/g);
                    if (ids) {
                        ids.forEach(match => {
                            const id = match.replace(/[^0-9]/g, '');
                            const propUrl = `${MAPIOLE_BASE}/product/${id}`;
                            if (!interceptedUrls.includes(propUrl))
                                interceptedUrls.push(propUrl);
                        });
                    }
                }
                catch { }
            }
        });
        await page.goto(`${MAPIOLE_BASE}/product-listing`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000);
        allDetailUrls.push(...interceptedUrls.filter(u => !allDetailUrls.includes(u)));
        console.log(`      → Intercepted ${interceptedUrls.length} potential property URLs`);
    }
    console.log(`   📋 Total Mapiole listings to scrape: ${allDetailUrls.length}`);
    for (let i = 0; i < allDetailUrls.length; i++) {
        const url = allDetailUrls[i];
        process.stdout.write(`   [${i + 1}/${allDetailUrls.length}] Scraping... `);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(2000);
            const data = await page.evaluate(() => {
                const getText = (selector) => document.querySelector(selector)?.textContent?.trim() ?? '';
                const pageText = document.body.innerText;
                const imgs = [];
                document.querySelectorAll('img').forEach(img => {
                    const src = img.src || img.getAttribute('data-src') || '';
                    if (src &&
                        !src.includes('logo') &&
                        !src.includes('icon') &&
                        !src.includes('avatar') &&
                        !src.includes('placeholder') &&
                        (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp')))
                        imgs.push(src);
                });
                let jsonLdData = null;
                document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
                    try {
                        const parsed = JSON.parse(script.textContent ?? '');
                        if (parsed['@type'] === 'RealEstateListing' || parsed.name || parsed.price) {
                            jsonLdData = parsed;
                        }
                    }
                    catch { }
                });
                return {
                    title: getText('h1') || getText('[class*="title"]') || (jsonLdData?.name ?? 'Annonce'),
                    price: getText('[class*="price"], [class*="prix"], [class*="amount"]') || String(jsonLdData?.offers?.price ?? ''),
                    description: getText('[class*="description"] p, [class*="detail"] p, article p'),
                    location: getText('[class*="location"], [class*="address"], [class*="adresse"], [class*="city"]'),
                    typeText: getText('[class*="type"], [class*="category"], nav[aria-label="breadcrumb"]'),
                    pageText: pageText.slice(0, 4000),
                    images: [...new Set(imgs)].slice(0, 10),
                    phone: pageText.match(/\+?237[\s\-]?\d{8,9}/)?.[0] ?? '',
                    jsonLd: jsonLdData,
                };
            });
            const city = parseCity(data.location || data.title);
            const country = parseCountry(city);
            const listingType = parseListingType(data.typeText || data.title || data.pageText);
            const type = parsePropertyType(data.typeText || data.title);
            const price = parsePrice(data.price || '');
            const bedsMatch = data.pageText.match(/(\d+)\s*(?:chambre|bedroom)/i);
            const bathsMatch = data.pageText.match(/(\d+)\s*(?:salle de bain|douche|bathroom)/i);
            const areaMatch = data.pageText.match(/(\d+)\s*m[²2]/i);
            if (price === 0) {
                console.log(`⏭  skipped (no price)`);
                await sleep(DETAIL_DELAY_MS);
                continue;
            }
            results.push({
                source: 'mapiole',
                sourceId: url.split('/').filter(Boolean).pop() ?? url,
                sourceUrl: url,
                title: data.title,
                description: (data.description || data.title).slice(0, 2000),
                price,
                currency: 'XAF',
                listingType,
                type,
                city,
                neighborhood: data.location.split(',')[0]?.trim() || '',
                address: data.location || city,
                country,
                bedrooms: bedsMatch ? parseInt(bedsMatch[1], 10) : 0,
                bathrooms: bathsMatch ? parseInt(bathsMatch[1], 10) : 0,
                area: areaMatch ? parseInt(areaMatch[1], 10) : null,
                images: data.images,
                contactPhone: data.phone,
                scrapedAt: new Date().toISOString(),
            });
            console.log(`✅ ${data.title.slice(0, 55)}`);
        }
        catch (err) {
            console.warn(`⚠️  ${err.message}`);
        }
        await sleep(DETAIL_DELAY_MS);
    }
    await browser.close();
    console.log(`\n   ✅ Mapiole: ${results.length} properties scraped`);
    return results;
}
async function importToMongo(properties, ownerId) {
    const PropertyModel = mongoose_1.default.model('Property', property_schema_1.PropertySchema);
    let inserted = 0;
    let skipped = 0;
    for (const prop of properties) {
        const exists = await PropertyModel.findOne({ slug: prop.sourceUrl });
        if (exists) {
            skipped++;
            continue;
        }
        const images = prop.images.map((url, i) => ({
            url,
            publicId: `scraped/${prop.source}/${prop.sourceId}_${i}`,
            caption: i === 0 ? 'Vue principale' : 'Photo',
            isMain: i === 0,
        }));
        await PropertyModel.create({
            title: prop.title,
            slug: prop.sourceUrl,
            description: prop.description,
            price: prop.price,
            currency: prop.currency,
            type: prop.type,
            listingType: prop.listingType,
            city: prop.city,
            neighborhood: prop.neighborhood,
            address: prop.address,
            country: prop.country,
            location: { type: 'Point', coordinates: [0, 0] },
            images,
            amenities: {
                bedrooms: prop.bedrooms,
                bathrooms: prop.bathrooms,
            },
            area: prop.area ?? undefined,
            contactPhone: prop.contactPhone,
            ownerId,
            pricingUnit: prop.listingType === property_schema_1.ListingType.SHORT_TERM ? property_schema_1.PricingUnit.NIGHTLY : property_schema_1.PricingUnit.MONTHLY,
            availability: property_schema_1.PropertyStatus.ACTIVE,
            approvalStatus: property_schema_1.ApprovalStatus.APPROVED,
            isVerified: false,
            isFeatured: false,
            isActive: true,
            cancellationPolicy: property_schema_1.CancellationPolicy.FLEXIBLE,
            keywords: [prop.city, prop.type, prop.listingType, prop.country.toLowerCase()],
            viewsCount: 0,
            inquiriesCount: 0,
            favoritesCount: 0,
            sharesCount: 0,
            minNights: 1,
            maxNights: 365,
            cleaningFee: 0,
            serviceFee: 0,
            weeklyDiscountPercent: 0,
            monthlyDiscountPercent: 0,
            isStudentFriendly: false,
            tourType: 'none',
            tourViews: 0,
        });
        inserted++;
    }
    return { inserted, skipped };
}
async function main() {
    console.log('🌍 HoroHouse Real Property Scraper');
    console.log(`   Immooz   : ${SCRAPE_IMMOOZ}`);
    console.log(`   Mapiole  : ${SCRAPE_MAPIOLE}`);
    console.log(`   Max pages: ${MAX_PAGES}`);
    console.log(`   Dry run  : ${DRY_RUN}`);
    console.log('');
    ensureOutputDir();
    const allScraped = [];
    if (SCRAPE_IMMOOZ) {
        const immoozResults = await runImmoozScraper();
        allScraped.push(...immoozResults);
        saveJson(`immooz-${Date.now()}.json`, immoozResults);
    }
    if (SCRAPE_MAPIOLE) {
        const mapioleResults = await runMapioleScraper();
        allScraped.push(...mapioleResults);
        saveJson(`mapiole-${Date.now()}.json`, mapioleResults);
    }
    saveJson(`all-properties-${Date.now()}.json`, allScraped);
    console.log(`\n📊 Total scraped: ${allScraped.length} properties`);
    if (DRY_RUN) {
        console.log('\n⚡ Dry run — skipping MongoDB import.');
        return;
    }
    if (allScraped.length === 0) {
        console.log('\n⚠️  Nothing to import.');
        return;
    }
    console.log('\n📥 Connecting to MongoDB...');
    await mongoose_1.default.connect(MONGO_URI);
    console.log('✅ Connected');
    const UserModel = mongoose_1.default.model('User', user_schema_1.UserSchema);
    let ownerId;
    if (process.env.OWNER_ID) {
        ownerId = new mongoose_1.Types.ObjectId(process.env.OWNER_ID);
    }
    else {
        const admin = await UserModel.findOne({ role: user_schema_1.UserRole.ADMIN });
        if (!admin)
            throw new Error('No admin user found. Run seed.ts first or set OWNER_ID env var.');
        ownerId = admin._id;
        console.log(`👤 Owner: ${admin.name} (${admin._id})`);
    }
    console.log('\n📥 Importing to MongoDB...');
    const { inserted, skipped } = await importToMongo(allScraped, ownerId);
    console.log(`\n🎉 Import complete!`);
    console.log(`   ✅ Inserted : ${inserted}`);
    console.log(`   ⏭  Skipped  : ${skipped} (duplicates)`);
    console.log(`   📁 JSON backup in: ${OUTPUT_DIR}`);
    await mongoose_1.default.disconnect();
}
main().catch(err => {
    console.error('\n❌ Scraper failed:', err.message);
    process.exit(1);
});
//# sourceMappingURL=scraper.js.map