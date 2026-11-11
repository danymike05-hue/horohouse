/**
 * Picture shown in a phone notification (the big photo under the text).
 *
 * Phones only show JPEG/PNG reliably (iPhone can't attach WebP) and Android
 * drops images over ~1 MB, so Cloudinary photos are asked for as a 1024 px JPEG.
 * Anything that isn't a public https link is ignored.
 */
export function pushImageUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const url = raw.trim();
  if (!/^https:\/\//i.test(url)) return undefined;

  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    // Don't stack transforms on a link that already has some
    if (/\/upload\/[a-z]_[^/]*\//i.test(url)) return url;
    return url.replace('/upload/', '/upload/f_jpg,q_auto,w_1024,c_limit/');
  }
  return url;
}

/** Main photo of a listing: the one marked main, otherwise the first */
export function listingCoverUrl(images?: Array<{ url?: string; isMain?: boolean }> | null): string | undefined {
  if (!Array.isArray(images) || !images.length) return undefined;
  const main = images.find((i) => i?.isMain && i?.url) ?? images.find((i) => i?.url);
  return pushImageUrl(main?.url);
}
