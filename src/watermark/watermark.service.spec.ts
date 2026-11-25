// The emblem is stamped in the middle of the photo as people see it, and nowhere else.
import { WatermarkService } from './watermark.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof import('sharp').default = require('sharp');

const photo = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 3, background } });

/** How far a region strays from the plain colour of the photo (0 = untouched) */
async function change(buffer: Buffer, region: { left: number; top: number; width: number; height: number }) {
  const { data } = await sharp(buffer).extract(region).greyscale().raw().toBuffer({ resolveWithObject: true });
  return Math.max(...data) - Math.min(...data);
}

describe('photo watermark', () => {
  const service = new WatermarkService();

  it.each([['#ffffff'], ['#1f2937'], ['#8a8a8a']])('shows in the middle of a %s photo and leaves the corners alone', async (colour) => {
    const out = await service.applyWatermark(await photo(1200, 900, colour).jpeg({ quality: 95 }).toBuffer());
    expect(await change(out, { left: 500, top: 350, width: 200, height: 200 })).toBeGreaterThan(20);
    expect(await change(out, { left: 0, top: 0, width: 300, height: 250 })).toBeLessThan(4);
    expect(await change(out, { left: 900, top: 650, width: 300, height: 250 })).toBeLessThan(4);
  });

  it('turns a phone photo upright before stamping it', async () => {
    const sideways = await photo(1200, 800, '#334155').jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await service.applyWatermark(sideways);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height, meta.orientation ?? 1]).toEqual([800, 1200, 1]);
    expect(await change(out, { left: 300, top: 500, width: 200, height: 200 })).toBeGreaterThan(20);
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
