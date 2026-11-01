/**
 * HoroHouse — Seed Image Uploader
 * ─────────────────────────────────
 * Downloads curated property photos from Unsplash and uploads them
 * to your Cloudinary account under the `seed/properties` folder.
 *
 * Run this ONCE before running seed.ts:
 *   npx ts-node -r tsconfig-paths/register seed-images.ts
 *
 * It writes `seed-image-manifest.json` — a map of property type →
 * array of { url, publicId } objects that seed.ts will read.
 *
 * Install deps if missing:
 *   npm install --save-dev cloudinary node-fetch@2
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ─── Cloudinary v2 SDK ────────────────────────────────────────────────────────
// Uses your existing credentials from .env
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? 'dgvteiiku',
  api_key:    process.env.CLOUDINARY_API_KEY    ?? '145119745711413',
  api_secret: process.env.CLOUDINARY_API_SECRET ?? 'ZNVJneCRDIUChtRhL62K6rcWUbM',
});

// ─── Curated Unsplash image pools per property type ──────────────────────────
// Each entry is an Unsplash photo ID (stable, no API key needed for direct access)
// Format: https://images.unsplash.com/photo-{ID}?w=1200&q=80

const UNSPLASH_POOLS: Record<string, string[]> = {
  apartment: [
    '1502672260266-1c1ef2d93688', // modern apartment living room
    '1560448204-e02f11c3d0e2', // bright apartment interior
    '1522708323590-d24dbb6b0267', // cozy apartment
    '1484154218962-a197022b5858', // kitchen apartment
    '1493809842364-78817add7ffb', // apartment bedroom
    '1567767292278-a35ad850b38e', // modern apartment exterior
    '1554995207-c18c203602cb', // apartment living space
    '1512917774080-9991f1c4c750', // luxury apartment pool view
  ],
  house: [
    '1568605114967-8130f3a36994', // family house exterior
    '1558618666-fcd25c85cd64', // house with garden
    '1523217582562-09d05ba00bdb', // tropical house
    '1600585154340-be6161a56a0c', // modern house Africa
    '1600596542815-ffad4c1539a9', // house entrance
    '1600607687939-ce8a6c25118c', // house interior
    '1583608205776-bfd35f0d9f83', // house living room
    '1570129477492-45c003edd2be', // suburban house
  ],
  villa: [
    '1512917774080-9991f1c4c750', // villa with pool
    '1613490493576-4d884d52efad', // luxury villa
    '1600047509807-ba8f99d2cdde', // villa exterior
    '1600210492486-724c8215aa9a', // villa interior
    '1582268611958-ebfd161ef9cf', // villa garden
    '1600585154526-990dced4db0d', // villa terrace
    '1600047508788-786f3865b39c', // villa pool area
  ],
  studio: [
    '1536376072261-38c75010e6c9', // studio apartment
    '1505693416388-ac5ce068fe85', // small studio interior
    '1574362848149-11496d93a7c7', // studio bedroom
    '1631679706909-1844bbd07221', // modern studio
    '1598928506311-c55ded91a20c', // studio living area
    '1598928506311-c55ded91a21c', // studio kitchen
  ],
  duplex: [
    '1600566752355-35792bedcfea', // duplex stairs
    '1600607687644-c7171b42498b', // duplex interior
    '1600210491892-03d54b0bab54', // two-story home
    '1600585154340-be6161a56a0c', // duplex exterior
  ],
  land: [
    '1500382017468-9049fed747ef', // land plot Africa
    '1464822759023-fed622ff2c3b', // empty land
    '1416331108676-a22ccb276e35', // land with trees
    '1500076656116-558758c991c1', // construction land
  ],
  commercial: [
    '1497366216548-37526070297c', // office space
    '1497366754035-f200968a6e72', // commercial interior
    '1504384308090-c894fdcc538d', // modern office
    '1556761175-4b46a572b786', // business space
  ],
  shortterm: [
    '1566073771259-470dcdba7ffe', // hotel room
    '1520250497591-112f2f40a3f4', // resort pool
    '1582719508461-905c673771fd', // vacation rental
    '1571896349842-33c89424de2d', // guesthouse room
    '1584132967334-10e028bd69f7', // hotel suite
    '1578683010236-d716f9a3f461', // boutique hotel
  ],
  student: [
    '1555854877-bab93f4c5da9', // student room
    '1598928506311-c55ded91a20c', // furnished studio
    '1536376072261-38c75010e6c9', // small apartment
    '1505693416388-ac5ce068fe85', // simple interior
  ],
  exterior: [
    '1560518883-ce09059eeffa', // apartment building Africa
    '1545324418-cc1a3fa8f48d', // residential building
    '1600585154340-be6161a56a0c', // house exterior
    '1568605114967-8130f3a36994', // neighborhood
    '1523217582562-09d05ba00bdb', // tropical building
    '1612966861719-3873b5b5a0b6', // African city building
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageRecord {
  url: string;
  publicId: string;
}

type Manifest = Record<string, ImageRecord[]>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?w=1200&q=80&auto=format&fit=crop`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFromUrl(imageUrl: string, publicId: string): Promise<ImageRecord> {
  const result = await cloudinary.uploader.upload(imageUrl, {
    public_id: publicId,
    folder: 'seed/properties',
    overwrite: false,          // skip if already uploaded (idempotent)
    resource_type: 'image',
    transformation: [
      { width: 1200, height: 800, crop: 'fill', gravity: 'auto', quality: 'auto:good' },
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const MANIFEST_PATH = path.join(__dirname, 'seed-image-manifest.json');

async function main() {
  console.log('☁️  HoroHouse — Cloudinary Image Uploader');
  console.log(`   Cloud: ${process.env.CLOUDINARY_CLOUD_NAME ?? 'dgvteiiku'}`);
  console.log(`   Manifest: ${MANIFEST_PATH}\n`);

  // Load existing manifest if present (allows resuming interrupted runs)
  const manifest: Manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    : {};

  let uploaded = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const [category, photoIds] of Object.entries(UNSPLASH_POOLS)) {
    console.log(`\n📁 Category: ${category} (${photoIds.length} images)`);
    manifest[category] = manifest[category] ?? [];

    for (const photoId of photoIds) {
      const publicId = `seed/properties/${category}/${photoId}`;

      // Check if already in manifest
      if (manifest[category].some(r => r.publicId.includes(photoId))) {
        process.stdout.write(`   ⏭  skipped ${photoId}\n`);
        skipped++;
        continue;
      }

      try {
        process.stdout.write(`   ⬆  uploading ${photoId}... `);
        const record = await uploadFromUrl(unsplashUrl(photoId), publicId);
        manifest[category].push(record);
        uploaded++;
        console.log(`✅`);

        // Save manifest after every upload so progress isn't lost on crash
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

        // Rate-limit: Cloudinary free tier allows ~500 uploads/hour
        await sleep(300);
      } catch (err: any) {
        console.log(`❌ ${err.message}`);
        failed++;
        await sleep(1000); // longer pause on error
      }
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`✅ Uploaded : ${uploaded}`);
  console.log(`⏭  Skipped  : ${skipped}`);
  console.log(`❌ Failed   : ${failed}`);
  console.log(`\n📄 Manifest saved to: ${MANIFEST_PATH}`);
  console.log(`\nNext step: run seed.ts — it will automatically use this manifest.`);
}

main().catch(err => {
  console.error('❌ Uploader failed:', err);
  process.exit(1);
});