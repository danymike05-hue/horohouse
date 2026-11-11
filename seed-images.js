"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? 'dgvteiiku',
    api_key: process.env.CLOUDINARY_API_KEY ?? '145119745711413',
    api_secret: process.env.CLOUDINARY_API_SECRET ?? 'ZNVJneCRDIUChtRhL62K6rcWUbM',
});
const UNSPLASH_POOLS = {
    apartment: [
        '1502672260266-1c1ef2d93688',
        '1560448204-e02f11c3d0e2',
        '1522708323590-d24dbb6b0267',
        '1484154218962-a197022b5858',
        '1493809842364-78817add7ffb',
        '1567767292278-a35ad850b38e',
        '1554995207-c18c203602cb',
        '1512917774080-9991f1c4c750',
    ],
    house: [
        '1568605114967-8130f3a36994',
        '1558618666-fcd25c85cd64',
        '1523217582562-09d05ba00bdb',
        '1600585154340-be6161a56a0c',
        '1600596542815-ffad4c1539a9',
        '1600607687939-ce8a6c25118c',
        '1583608205776-bfd35f0d9f83',
        '1570129477492-45c003edd2be',
    ],
    villa: [
        '1512917774080-9991f1c4c750',
        '1613490493576-4d884d52efad',
        '1600047509807-ba8f99d2cdde',
        '1600210492486-724c8215aa9a',
        '1582268611958-ebfd161ef9cf',
        '1600585154526-990dced4db0d',
        '1600047508788-786f3865b39c',
    ],
    studio: [
        '1536376072261-38c75010e6c9',
        '1505693416388-ac5ce068fe85',
        '1574362848149-11496d93a7c7',
        '1631679706909-1844bbd07221',
        '1598928506311-c55ded91a20c',
        '1598928506311-c55ded91a21c',
    ],
    duplex: [
        '1600566752355-35792bedcfea',
        '1600607687644-c7171b42498b',
        '1600210491892-03d54b0bab54',
        '1600585154340-be6161a56a0c',
    ],
    land: [
        '1500382017468-9049fed747ef',
        '1464822759023-fed622ff2c3b',
        '1416331108676-a22ccb276e35',
        '1500076656116-558758c991c1',
    ],
    commercial: [
        '1497366216548-37526070297c',
        '1497366754035-f200968a6e72',
        '1504384308090-c894fdcc538d',
        '1556761175-4b46a572b786',
    ],
    shortterm: [
        '1566073771259-470dcdba7ffe',
        '1520250497591-112f2f40a3f4',
        '1582719508461-905c673771fd',
        '1571896349842-33c89424de2d',
        '1584132967334-10e028bd69f7',
        '1578683010236-d716f9a3f461',
    ],
    student: [
        '1555854877-bab93f4c5da9',
        '1598928506311-c55ded91a20c',
        '1536376072261-38c75010e6c9',
        '1505693416388-ac5ce068fe85',
    ],
    exterior: [
        '1560518883-ce09059eeffa',
        '1545324418-cc1a3fa8f48d',
        '1600585154340-be6161a56a0c',
        '1568605114967-8130f3a36994',
        '1523217582562-09d05ba00bdb',
        '1612966861719-3873b5b5a0b6',
    ],
};
function unsplashUrl(photoId) {
    return `https://images.unsplash.com/photo-${photoId}?w=1200&q=80&auto=format&fit=crop`;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function uploadFromUrl(imageUrl, publicId) {
    const result = await cloudinary_1.v2.uploader.upload(imageUrl, {
        public_id: publicId,
        folder: 'seed/properties',
        overwrite: false,
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
const MANIFEST_PATH = path.join(__dirname, 'seed-image-manifest.json');
async function main() {
    console.log('☁️  HoroHouse — Cloudinary Image Uploader');
    console.log(`   Cloud: ${process.env.CLOUDINARY_CLOUD_NAME ?? 'dgvteiiku'}`);
    console.log(`   Manifest: ${MANIFEST_PATH}\n`);
    const manifest = fs.existsSync(MANIFEST_PATH)
        ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
        : {};
    let uploaded = 0;
    let skipped = 0;
    let failed = 0;
    for (const [category, photoIds] of Object.entries(UNSPLASH_POOLS)) {
        console.log(`\n📁 Category: ${category} (${photoIds.length} images)`);
        manifest[category] = manifest[category] ?? [];
        for (const photoId of photoIds) {
            const publicId = `seed/properties/${category}/${photoId}`;
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
                fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
                await sleep(300);
            }
            catch (err) {
                console.log(`❌ ${err.message}`);
                failed++;
                await sleep(1000);
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
//# sourceMappingURL=seed-images.js.map