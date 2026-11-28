import { v2 as cloudinary } from 'cloudinary';
import { TrustService } from './trust.service';

const NOW = new Date('2026-12-31T12:00:00Z');
const chain = (rows: any[]) => ({ select: () => ({ limit: () => ({ lean: () => ({ exec: async () => rows }) }) }) });

function build(sets: { checked?: any[]; hosts?: any[]; students?: any[] }) {
  const finds: any[] = [];
  const updates: any[] = [];
  const profiles = {
    find: jest.fn((q: any) => { finds.push(['students', q]); return chain(sets.students ?? []); }),
    updateOne: jest.fn((f: any, u: any) => { updates.push(['students', f, u]); return { exec: async () => ({}) }; }),
  };
  const userModel: any = {
    find: jest.fn((q: any) => {
      finds.push(['users', q]);
      return chain(q['identityVerification.documentPublicId'] ? sets.checked ?? [] : sets.hosts ?? []);
    }),
    updateOne: jest.fn((f: any, u: any) => { updates.push(['users', f, u]); return { exec: async () => ({}) }; }),
    db: { model: () => profiles },
  };
  const service = new TrustService(userModel, {} as any, {} as any);
  return { service, finds, updates };
}

describe('ID photos are deleted 30 days after the decision', () => {
  let destroy: jest.SpyInstance;
  beforeEach(() => {
    destroy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' } as any);
  });
  afterEach(() => destroy.mockRestore());

  it('asks only for decided documents reviewed more than 30 days ago', async () => {
    const { service, finds } = build({});
    await service.deleteOldIdPhotos(NOW);
    const cutoff = new Date(NOW.getTime() - 30 * 86_400_000);
    for (const [, q] of finds) {
      const status = q['identityVerification.status'] ?? q['hostProfile.verificationStatus'] ?? q.verificationStatus;
      expect(status).toEqual({ $in: ['verified', 'rejected'] });
      const reviewed = q['identityVerification.reviewedAt'] ?? q['hostProfile.verificationReviewedAt'] ?? q.verificationReviewedAt;
      expect(reviewed).toEqual({ $lt: cutoff });
    }
    expect(finds).toHaveLength(3);
  });

  it('deletes the file and forgets it, keeping the result', async () => {
    const { service, updates } = build({
      checked: [{ _id: 'u1', identityVerification: { documentPublicId: 'horohouse/identity/a' } }],
      hosts: [{ _id: 'u2', hostProfile: { governmentIdPublicId: 'horohouse/host-ids/b' } }],
      students: [{ _id: 's1', userId: 'u3', studentIdPublicId: 'horohouse/student-ids/c' }],
    });
    await expect(service.deleteOldIdPhotos(NOW)).resolves.toBe(3);
    const ids = destroy.mock.calls.map((c) => c[0]);
    expect(ids).toEqual(expect.arrayContaining(['horohouse/identity/a', 'horohouse/host-ids/b', 'horohouse/student-ids/c']));
    expect(updates.find(([, f]) => f._id === 'u1')[2]).toEqual({ $unset: { 'identityVerification.documentPublicId': 1 } });
    // the status itself is never unset
    for (const [, , u] of updates) expect(JSON.stringify(u)).not.toMatch(/status/i);
  });
});
