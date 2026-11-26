import { Injectable, Logger } from '@nestjs/common';
import { HOROHOUSE_LABEL, HOROHOUSE_MARK } from './horohouse-label';
// sharp 0.35 ships ESM-style types; at runtime require() still returns the function
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

/** Cloudinary refuses images above 10 MB */
const MAX_UPLOAD_BYTES = 9.5 * 1024 * 1024;

/**
 * The app's Explore cards cut photos to this height / width, keeping the middle. The mark
 * stays inside that cut, so it's never sliced or lost on a card (square and portrait photos
 * lose a lot of their bottom there), and above the photo dots, which sit in its last 8%. The
 * smaller map cards cut a little more: the clearance covers them too.
 */
const CARD_RATIO = 0.66;
const CARD_CLEARANCE = 0.15;

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  /**
   * The HH logo and the name on one line, low in the middle of the photo: white, with a soft
   * dark edge so it stays readable on white walls. The layer is only as big as the mark: one
   * the size of a phone photo would cost ~50 MB of memory per upload.
   *
   * Drawn as vector outlines (<path>), never as <text>. librsvg (what sharp uses for SVG) only
   * renders fonts installed on the machine and ignores @font-face, and the server image has
   * none: every letter came out as a square. Outlines need no font.
   */
  private signature(width: number, height: number): { input: Buffer; left: number; top: number } {
    const size = Math.min(width, height) * 0.062; // the logo
    const cap = size * 0.5; // capital letters of the name
    const gap = size * 0.26;
    const scale = cap / HOROHOUSE_LABEL.capHeight;
    const total = size + gap + HOROHOUSE_LABEL.width * scale;
    const blur = size * 0.1;
    const pad = blur * 4; // room for the dark edge

    // Never larger than the photo (sharp refuses that)
    const w = Math.max(1, Math.min(width, Math.ceil(total + pad * 2)));
    const h = Math.max(1, Math.min(height, Math.ceil(size + pad * 2)));

    const shown = Math.min(height, width * CARD_RATIO); // the height a card shows
    const bottom = (height + shown) / 2 - shown * CARD_CLEARANCE; // where the logo ends
    const clamp = (x: number, max: number) => Math.round(Math.min(Math.max(0, x), max));

    const n = (x: number) => x.toFixed(3);
    const { ring } = HOROHOUSE_MARK;
    const x0 = (w - total) / 2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <filter id="edge" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${n(blur)}"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g opacity="0.9" filter="url(#edge)">
    <g transform="translate(${n(x0)} ${n(pad)}) scale(${(size / HOROHOUSE_MARK.size).toFixed(6)})">
      <circle cx="${ring.centre}" cy="${ring.centre}" r="${ring.radius}" fill="none" stroke="#FFFFFF" stroke-width="${ring.stroke}"/>
      <path fill="#FFFFFF" d="${HOROHOUSE_MARK.d}"/>
    </g>
    <path fill="#FFFFFF" transform="translate(${n(x0 + size + gap)} ${n(pad + (size + cap) / 2)}) scale(${scale.toFixed(6)})" d="${HOROHOUSE_LABEL.d}"/>
  </g>
</svg>`;

    return {
      input: Buffer.from(svg),
      left: clamp((width - w) / 2, width - w),
      top: clamp(bottom - size - pad, height - h),
    };
  }

  async applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
    const { width = 800, height = 600, orientation = 1, format } = await sharp(imageBuffer).metadata();
    // Phone photos carry their rotation in EXIF: 5 to 8 are a quarter turn, so the picture
    // people see has its sides swapped
    const [w, h] = orientation >= 5 ? [height, width] : [width, height];
    const overlay = this.signature(w, h);

    // One pass: turned upright, stamped and saved once. It used to be saved twice, which
    // blurred photos a little more each time.
    const save = (quality: number) => {
      const stamped = sharp(imageBuffer).rotate().composite([overlay]);
      if (format === 'jpeg') stamped.jpeg({ quality });
      else if (format === 'webp') stamped.webp({ quality });
      return stamped.toBuffer();
    };

    const out = await save(90);
    return out.length > MAX_UPLOAD_BYTES ? save(80) : out;
  }
}
