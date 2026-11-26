// The signature is stamped low in the middle of the photo as people see it, and stays whole on
// the app's cards, which cut the top and bottom of photos.
import { WatermarkService } from './watermark.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

const photo = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 3, background } });

/** The rows and columns the mark touches on a plain photo */
async function markBox(buffer: Buffer) {
  const { data, info } = await sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  const plain = data[0];
  const box = { left: info.width, right: -1, top: info.height, bottom: -1 };
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (Math.abs(data[(y * info.width + x) * info.channels] - plain) < 12) continue;
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
  }
  return { ...box, width: info.width, height: info.height };
}

describe('photo watermark', () => {
  const service = new WatermarkService();

  it.each([['#ffffff'], ['#1f2937'], ['#8a8a8a']])('shows on a %s photo, centred and small', async (colour) => {
    const b = await markBox(await service.applyWatermark(await photo(1200, 900, colour).png().toBuffer()));
    expect(b.right).toBeGreaterThan(b.left);
    expect(Math.abs((b.left + b.right) / 2 - 600)).toBeLessThan(6);
    expect(b.right - b.left).toBeLessThan(1200 * 0.3);
    expect(b.top).toBeGreaterThan(900 * 0.6); // the lower part
  });

  it.each([
    ['landscape', 1200, 900], ['wide', 1600, 900], ['square', 1000, 1000], ['portrait', 900, 1200], ['tall', 900, 1600],
  ])('stays whole, above the photo dots, on a card showing a %s photo', async (_name, w, h) => {
    const b = await markBox(await service.applyWatermark(await photo(w, h, '#1f2937').png().toBuffer()));
    // Explore: 0.66 high, dots in the last 8%. Map: 0.475 high, no dots.
    for (const [ratio, dots] of [[0.66, 0.08], [0.475, 0]]) {
      const shown = Math.min(h, w * ratio);
      const end = (h + shown) / 2;
      expect(b.bottom).toBeLessThan(end - shown * dots);
      expect(b.top).toBeGreaterThan(end - shown);
    }
  });

  it('turns a phone photo upright before stamping it', async () => {
    const sideways = await photo(1200, 800, '#334155').jpeg({ quality: 100 }).withMetadata({ orientation: 6 }).toBuffer();
    const b = await markBox(await service.applyWatermark(sideways));
    expect([b.width, b.height]).toEqual([800, 1200]);
    expect(Math.abs((b.left + b.right) / 2 - 400)).toBeLessThan(6);
    expect(b.top).toBeGreaterThan(600);
  });

  it.each(['jpeg', 'png', 'webp'] as const)('keeps the %s format', async (format) => {
    const out = await service.applyWatermark(await photo(640, 480, '#456').toFormat(format).toBuffer());
    expect((await sharp(out).metadata()).format).toBe(format);
  });

  it.each([[4000, 120], [120, 4000], [60, 60], [8, 8], [1, 1]])('accepts an odd %i × %i photo', async (w, h) => {
    const out = await service.applyWatermark(await photo(w, h, '#456').png().toBuffer());
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([w, h]);
  });
});
