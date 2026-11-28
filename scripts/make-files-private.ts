// One-off: makes the older ID documents and lease files private on Cloudinary.
//
// They were uploaded as public files ("upload"), so anyone holding a link could open them:
// host ID photos, student cards, lease signatures and move-in photos. New uploads are already
// private ("authenticated"); this moves the old ones and saves their new links.
//
// Run from the api folder, with the same settings as the server (.env):
//   npx ts-node -r dotenv/config scripts/make-files-private.ts            (dry run: lists only)
//   npx ts-node -r dotenv/config scripts/make-files-private.ts --apply    (does it)
//
// Safe to run again: files that are already private are skipped.
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

const APPLY = process.argv.includes('--apply');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** "…/image/upload/v123/folder/name.jpg" → "folder/name" (public files only) */
function publicIdOfPublicUrl(url?: string | null): string | null {
  if (!url || !/\/image\/upload\//.test(url)) return null;
  const m = /\/image\/upload\/(?:[^/]+\/)*?(?:v\d+\/)(.+?)(?:\.[a-z0-9]+)?$/i.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

let moved = 0;
let failed = 0;

/** Moves one public file to private. Returns its new link, or null when nothing was done. */
async function makePrivate(publicId: string | null, label: string): Promise<string | null> {
  if (!publicId) return null;
  if (!APPLY) {
    console.log(`would move  ${label}  ${publicId}`);
    moved++;
    return null;
  }
  try {
    const res: any = await cloudinary.uploader.rename(publicId, publicId, {
      type: 'upload',
      to_type: 'authenticated',
      overwrite: true,
      resource_type: 'image',
    } as any);
    moved++;
    console.log(`moved       ${label}  ${publicId}`);
    return res.secure_url as string;
  } catch (e: any) {
    // "Resource not found": already private, or deleted
    if (!/not found/i.test(e?.message ?? e?.error?.message ?? '')) {
      failed++;
      console.warn(`FAILED      ${label}  ${publicId}: ${e?.message ?? e?.error?.message}`);
    }
    return null;
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI (the .env of the API)');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db!;
  console.log(APPLY ? 'Moving files…' : 'Dry run (add --apply to move them)');

  // Host ID photos
  for await (const u of db.collection('users').find(
    { 'hostProfile.governmentIdUrl': /\/image\/upload\// },
    { projection: { 'hostProfile.governmentIdUrl': 1, 'hostProfile.governmentIdPublicId': 1 } },
  )) {
    const hp: any = (u as any).hostProfile;
    const id = hp.governmentIdPublicId || publicIdOfPublicUrl(hp.governmentIdUrl);
    const url = await makePrivate(id, 'host ID     ');
    if (url) await db.collection('users').updateOne({ _id: u._id }, { $set: { 'hostProfile.governmentIdUrl': url } });
  }

  // Student cards (kept on the profile, and copied on the user)
  for await (const p of db.collection('studentprofiles').find(
    { studentIdUrl: /\/image\/upload\// },
    { projection: { studentIdUrl: 1, studentIdPublicId: 1, userId: 1 } },
  )) {
    const id = (p as any).studentIdPublicId || publicIdOfPublicUrl((p as any).studentIdUrl);
    const url = await makePrivate(id, 'student card');
    if (url) {
      await db.collection('studentprofiles').updateOne({ _id: p._id }, { $set: { studentIdUrl: url } });
      await db.collection('users').updateOne({ _id: (p as any).userId }, { $set: { 'studentProfile.studentIdUrl': url } });
    }
  }

  // Lease signatures and move-in photos (stored as links only)
  for await (const l of db.collection('digitalleases').find({})) {
    const lease: any = l;
    const set: Record<string, any> = {};
    if (lease.landlordSignatureUrl) {
      const url = await makePrivate(publicIdOfPublicUrl(lease.landlordSignatureUrl), 'signature   ');
      if (url) set.landlordSignatureUrl = url;
    }
    for (const [key, val] of Object.entries(lease)) {
      if (!Array.isArray(val)) continue;
      let changed = false;
      const next = [];
      for (const item of val as any[]) {
        if (item && typeof item === 'object') {
          const copy = { ...item };
          if (typeof copy.signatureUrl === 'string') {
            const url = await makePrivate(publicIdOfPublicUrl(copy.signatureUrl), 'signature   ');
            if (url) { copy.signatureUrl = url; changed = true; }
          }
          if (Array.isArray(copy.photoUrls)) {
            const photos = [];
            for (const ph of copy.photoUrls) {
              const url = typeof ph === 'string' ? await makePrivate(publicIdOfPublicUrl(ph), 'lease photo ') : null;
              photos.push(url ?? ph);
              if (url) changed = true;
            }
            copy.photoUrls = photos;
          }
          next.push(copy);
        } else {
          next.push(item);
        }
      }
      if (changed) set[key] = next;
    }
    if (Object.keys(set).length) await db.collection('digitalleases').updateOne({ _id: lease._id }, { $set: set });
  }

  console.log(`${APPLY ? 'Moved' : 'Would move'} ${moved} file(s)${failed ? `, ${failed} failed` : ''}.`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
