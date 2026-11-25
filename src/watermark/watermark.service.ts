import { Injectable, Logger } from '@nestjs/common';
import { HOROHOUSE_LABEL, HOROHOUSE_MARK } from './horohouse-label';
// sharp 0.35 ships ESM-style types; at runtime require() still returns the function
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

/** Cloudinary refuses images above 10 MB */
const MAX_UPLOAD_BYTES = 9.5 * 1024 * 1024;

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  /**
   * The HH logo over the name, see-through white with a soft dark edge so it stays readable on
   * white walls and bright sky. Only as big as the emblem itself: a layer the size of a phone
   * photo would cost ~50 MB of memory per upload.
   *
   * Drawn as vector outlines (<path>), never as <text>. librsvg (what sharp uses for SVG) only
   * renders fonts installed on the machine and ignores @font-face, and the server image has
   * none: every letter came out as a square. Outlines need no font.
   */
  private emblem(width: number, height: number): Buffer {
    const size = Math.min(width, height) * 0.2; // the logo
    const cap = size * 0.17; // capital letters of the name
    const gap = size * 0.17;
    const scale = cap / HOROHOUSE_LABEL.capHeight;
    const nameWidth = HOROHOUSE_LABEL.width * scale;
    const blur = size * 0.035;
    const pad = blur * 4; // room for the dark edge

    // Never larger than the photo (sharp refuses that), e.g. a very thin strip
    const w = Math.max(1, Math.min(width, Math.ceil(Math.max(size, nameWidth) + pad * 2)));
    const h = Math.max(1, Math.min(height, Math.ceil(size + gap + cap + pad * 2)));
    const n = (x: number) => x.toFixed(3);
    const { ring } = HOROHOUSE_MARK;

    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <filter id="edge" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${n(blur)}"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g opacity="0.5" filter="url(#edge)">
    <g transform="translate(${n((w - size) / 2)} ${n(pad)}) scale(${n(size / HOROHOUSE_MARK.size)})">
      <circle cx="${ring.centre}" cy="${ring.centre}" r="${ring.radius}" fill="none" stroke="#FFFFFF" stroke-width="${ring.stroke}"/>
      <path fill="#FFFFFF" d="${HOROHOUSE_MARK.d}"/>
    </g>
    <path fill="#FFFFFF" transform="translate(${n((w - nameWidth) / 2)} ${n(pad + size + gap + cap)}) scale(${scale.toFixed(6)})" d="${HOROHOUSE_LABEL.d}"/>
  </g>
</svg>`);
  }

  async applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
    const { width = 800, height = 600, orientation = 1, format } = await sharp(imageBuffer).metadata();
    // Phone photos carry their rotation in EXIF: 5 to 8 are a quarter turn, so the picture
    // people see has its sides swapped
    const [w, h] = orientation >= 5 ? [height, width] : [width, height];
    const overlay = this.emblem(w, h);

    // One pass: turned upright, stamped and saved once. It used to be saved twice, which
    // blurred photos a little more each time.
    const save = (quality: number) => {
      const stamped = sharp(imageBuffer).rotate().composite([{ input: overlay, gravity: 'centre' }]);
      if (format === 'jpeg') stamped.jpeg({ quality });
      else if (format === 'webp') stamped.webp({ quality });
      return stamped.toBuffer();
    };

    const out = await save(90);
    return out.length > MAX_UPLOAD_BYTES ? save(80) : out;
  }
}
