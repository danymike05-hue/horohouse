import { v2 as cloudinary } from 'cloudinary';
import { publicIdFromUrl, signPrivateLinks, viewLink } from './private-files';

cloudinary.config({ cloud_name: 'demo', api_key: '1', api_secret: 'secret' });

const PRIVATE = 'https://res.cloudinary.com/demo/image/authenticated/s--abc123--/v17/horohouse/student-ids/card1.jpg';
const PUBLIC = 'https://res.cloudinary.com/demo/image/upload/v17/horohouse/student-ids/old.jpg';

describe('private files', () => {
  it('reads the file id from a private link', () => {
    expect(publicIdFromUrl(PRIVATE)).toBe('horohouse/student-ids/card1');
  });

  it('signs private links and leaves public ones alone', () => {
    const signed = viewLink(PRIVATE)!;
    expect(signed).toContain('/image/authenticated/');
    expect(signed).toContain('horohouse/student-ids/card1');
    expect(signed).not.toBe(PRIVATE);
    expect(viewLink(PUBLIC)).toBe(PUBLIC);
    expect(viewLink(undefined)).toBeUndefined();
  });

  it('signs the named fields at any depth, lists included', () => {
    const out: any = signPrivateLinks(
      {
        data: [{ name: 'Ada', studentIdUrl: PRIVATE }],
        lease: { signatures: [{ signatureUrl: PRIVATE }], items: [{ photoUrls: [PRIVATE, PUBLIC] }] },
      },
      ['studentIdUrl', 'signatureUrl', 'photoUrls'],
    );
    expect(out.data[0].name).toBe('Ada');
    expect(out.data[0].studentIdUrl).not.toBe(PRIVATE);
    expect(out.lease.signatures[0].signatureUrl).not.toBe(PRIVATE);
    expect(out.lease.items[0].photoUrls[0]).not.toBe(PRIVATE);
    expect(out.lease.items[0].photoUrls[1]).toBe(PUBLIC);
  });
});
