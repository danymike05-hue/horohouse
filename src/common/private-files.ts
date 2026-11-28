// Private files on Cloudinary (ID cards, lease signatures, condition photos).
//
// Uploaded with type "authenticated": their plain URL doesn't open. Whoever is allowed to see
// one gets a signed link that stops working after a while. Older files were public
// ("upload"): their URL works as it is, so it's passed through unchanged.
import { v2 as cloudinary } from 'cloudinary';

/** Upload options for a private image */
export const PRIVATE_IMAGE = { type: 'authenticated' as const, resource_type: 'image' as const };

/** How long a signed link works */
const LINK_SECONDS = 15 * 60;

/** "…/image/authenticated/s--sig--/v123/folder/name.jpg" → "folder/name" */
export function publicIdFromUrl(url: string): string | null {
  const m = /\/image\/authenticated\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

/** A link that opens the file for a short while; public files keep their URL */
export function viewLink(url?: string | null, publicId?: string | null): string | undefined {
  if (!url) return url ?? undefined;
  if (!/\/image\/authenticated\//.test(url)) return url;
  const id = publicId || publicIdFromUrl(url);
  if (!id) return url;
  return cloudinary.url(id, {
    type: 'authenticated',
    resource_type: 'image',
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + LINK_SECONDS,
  } as any);
}

/**
 * Replaces every private file link in a response (any depth) with a signed one.
 * `keys` are the fields holding links; a sibling `<key minus Url>PublicId` is used when present.
 */
export function signPrivateLinks<T>(value: T, keys: string[]): T {
  const plain: any = value && typeof (value as any).toObject === 'function' ? (value as any).toObject() : value;
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object' || node instanceof Date) return node;
    if (typeof node.toHexString === 'function') return node; // ObjectId
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (keys.includes(k) && typeof v === 'string') {
        out[k] = viewLink(v, node[k.replace(/Url$/, 'PublicId')]);
      } else if (keys.includes(k) && Array.isArray(v)) {
        out[k] = v.map((x) => (typeof x === 'string' ? viewLink(x) : walk(x)));
      } else {
        out[k] = walk(v && typeof (v as any).toObject === 'function' ? (v as any).toObject() : v);
      }
    }
    return out;
  };
  return walk(plain);
}
