import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as sharp from 'sharp';

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  /**
   * Base64-encoded Inter Bold font embedded at module load time.
   * This is critical: librsvg (used by sharp) only renders fonts that are
   * available via fontconfig. On most servers Arial is not installed, causing
   * every character to be rendered as a □ replacement glyph.
   * By embedding the font as a data URI inside the SVG <style> block we
   * guarantee the text always renders correctly regardless of the server OS.
   *
   * We resolve the font file via require.resolve() rather than manual
   * path.join(__dirname, '..', ...) math. Manual relative paths break the
   * moment the compiled dist/ folder structure changes depth (this is what
   * caused the ENOENT crash loop in production: __dirname pointed to
   * /app/dist/watermark, and one too many '..' segments walked past /app
   * all the way to filesystem root). require.resolve uses Node's own module
   * resolution, so it's correct regardless of nesting depth or environment.
   *
   * If font loading fails for any reason, we log it and fall back to an
   * empty string so a font/packaging issue can't crash the whole app on
   * boot (this field is a class field initializer, so a thrown error here
   * previously took down every request the service handled).
   */
  private readonly fontBase64: string = (() => {
    try {
      const fontPath = require.resolve(
        '@fontsource/inter/files/inter-latin-700-normal.woff',
      );
      return fs.readFileSync(fontPath).toString('base64');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        'WatermarkService: failed to load Inter font, watermark text will render without embedded font',
        err,
      );
      return '';
    }
  })();

  private generateWatermarkSvg(width: number, height: number): Buffer {
    const cx = width / 2;
    const cy = height / 2;
    const halfDiag = Math.sqrt(cx * cx + cy * cy);
    const radii = [halfDiag * 0.3, halfDiag * 0.65];

    const fontSize = Math.max(9, Math.round(width * 0.022));
    const opacity = 0.3;
    const label = 'HoroHouse';

    // For each radius, place rotated text labels around the circle
    const circleTexts = radii.flatMap((r) => {
      const circumference = 2 * Math.PI * r;
      const labelWidth = label.length * fontSize * 0.65 + 20; // approx char width + spacing
      const count = Math.max(2, Math.floor(circumference / labelWidth));

      return Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        const rad = (angle * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);

        return `
          <text
            x="${x}"
            y="${y}"
            text-anchor="middle"
            dominant-baseline="middle"
            font-family="Inter, sans-serif"
            font-size="${fontSize}"
            font-weight="700"
            letter-spacing="1"
            fill="white"
            fill-opacity="${opacity}"
            transform="rotate(${angle + 90}, ${x}, ${y})"
          >${label}</text>`;
      });
    });

    const fontFace = this.fontBase64
      ? `
            @font-face {
              font-family: 'Inter';
              font-style: normal;
              font-weight: 700;
              src: url('data:font/woff;base64,${this.fontBase64}') format('woff');
            }`
      : '';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <style>${fontFace}
          </style>
        </defs>
        ${circleTexts.join('\n')}
      </svg>`;

    return Buffer.from(svg);
  }

  async applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer);
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