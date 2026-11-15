import { Injectable, Logger } from '@nestjs/common';
import { HOROHOUSE_LABEL } from './horohouse-label';
// sharp 0.35 ships ESM-style types; at runtime require() still returns the function
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  /**
   * The word is drawn as vector outlines (<path>), never as <text>. librsvg (what sharp
   * uses for SVG) only renders fonts installed on the machine and ignores @font-face, and
   * the server image has none: every letter came out as a square. Outlines need no font.
   */
  private generateWatermarkSvg(width: number, height: number): Buffer {
    const cx = width / 2;
    const cy = height / 2;
    const halfDiag = Math.sqrt(cx * cx + cy * cy);
    const radii = [halfDiag * 0.3, halfDiag * 0.65];

    const fontSize = Math.max(9, Math.round(width * 0.022));
    const opacity = 0.3;
    const s = fontSize / 1000; // outlines are in 1/1000 em
    const labelWidth = HOROHOUSE_LABEL.width * s;
    // Centre each word on its point: half its width left, half the cap height down
    const centre = `translate(${(-HOROHOUSE_LABEL.width / 2).toFixed(1)} ${(HOROHOUSE_LABEL.capHeight / 2).toFixed(1)})`;

    // For each radius, place rotated labels around the circle
    const labels = radii.flatMap((r) => {
      const circumference = 2 * Math.PI * r;
      const count = Math.max(2, Math.floor(circumference / (labelWidth + 20)));
      return Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        const rad = (angle * Math.PI) / 180;
        const x = (cx + r * Math.cos(rad)).toFixed(1);
        const y = (cy + r * Math.sin(rad)).toFixed(1);
        return `<use href="#hh" xlink:href="#hh" transform="translate(${x} ${y}) rotate(${(angle + 90).toFixed(2)}) scale(${s.toFixed(5)}) ${centre}"/>`;
      });
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">
  <defs><path id="hh" d="${HOROHOUSE_LABEL.d}"/></defs>
  <g fill="#FFFFFF" fill-opacity="${opacity}">
    ${labels.join('\n    ')}
  </g>
</svg>`;

    return Buffer.from(svg);
  }

  async applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
    // Phone photos carry their rotation in EXIF: apply it first so the watermark is laid
    // over the picture as people see it (and the size below matches)
    const upright = await sharp(imageBuffer).rotate().toBuffer();
    const image = sharp(upright);
    const { width = 800, height = 600 } = await image.metadata();

    return image
      .composite([
        {
          input: this.generateWatermarkSvg(width, height),
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();
  }
}
