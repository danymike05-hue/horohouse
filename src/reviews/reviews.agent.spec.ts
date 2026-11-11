import { ReviewType } from './schemas/review.schema';
import { ReviewsService } from './reviews.service';

const AGENT = '507f1f77bcf86cd799439081';
const GUEST: any = { _id: '507f1f77bcf86cd799439082', name: 'Guest' };
const dto: any = { reviewType: ReviewType.AGENT, agentId: AGENT, rating: 4, comment: 'Helpful agent' };
const hit = (yes: boolean) => ({ exists: jest.fn().mockResolvedValue(yes ? { _id: 'x' } : null) });

function build({ stay = false, viewing = false, lease = false, agentId = AGENT } = {}) {
  const saved: any[] = [];
  const reviewModel: any = function (this: any, doc: any) { Object.assign(this, doc); this.save = async () => { saved.push(doc); return { _id: 'r', ...doc }; }; };
  reviewModel.findOne = jest.fn(() => ({ exec: () => Promise.resolve(null) }));
  const userModel: any = { findOne: jest.fn().mockResolvedValue({ _id: agentId }) };
  const bookings = hit(stay), viewings = hit(viewing), leases = hit(lease);
  const service = new ReviewsService(reviewModel, {} as any, userModel, bookings as any, viewings as any, leases as any);
  (service as any).checkExistingReview = jest.fn().mockResolvedValue(null);
  (service as any).updateAgentRating = jest.fn();
  return { service, saved, bookings, viewings, leases };
}

describe('agent reviews', () => {
  it('refuses someone who never dealt with the agent', async () => {
    const { service, saved } = build();
    await expect(service.create(dto, GUEST)).rejects.toThrow('after a stay, a viewing or a lease');
    expect(saved).toHaveLength(0);
  });

  it.each([['a completed stay', { stay: true }], ['a completed viewing', { viewing: true }], ['a signed lease', { lease: true }]])(
    'accepts %s, marked as verified',
    async (_label, dealing) => {
      const { service, saved } = build(dealing);
      await service.create(dto, GUEST);
      expect(saved[0]).toEqual(expect.objectContaining({ reviewType: ReviewType.AGENT, bookingVerified: true }));
    },
  );

  it('only counts finished or signed dealings with this agent', async () => {
    const { service, bookings, viewings, leases } = build({ stay: true });
    await service.create(dto, GUEST);
    expect(bookings.exists).toHaveBeenCalledWith(expect.objectContaining({ guestId: GUEST._id, status: 'completed' }));
    expect(viewings.exists).toHaveBeenCalledWith(expect.objectContaining({ clientId: GUEST._id, status: 'completed' }));
    expect(leases.exists).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ['active', 'expired', 'terminated'] } }));
  });

  it('nobody can review themselves', async () => {
    const { service } = build({ stay: true, agentId: GUEST._id });
    await expect(service.create({ ...dto, agentId: GUEST._id }, GUEST)).rejects.toThrow('cannot review yourself');
  });
});


describe('may I review this agent?', () => {
  function svc({ already = false, dealt = true } = {}) {
    const reviewModel: any = { exists: jest.fn().mockResolvedValue(already ? { _id: 'r' } : null) };
    const hit = (yes: boolean) => ({ exists: jest.fn().mockResolvedValue(yes ? { _id: 'x' } : null) });
    return new ReviewsService(reviewModel, {} as any, {} as any, hit(dealt) as any, hit(false) as any, hit(false) as any);
  }
  it('yes, after dealing with them', async () => {
    expect(await svc().canReviewAgent(GUEST._id, AGENT)).toEqual({ canReview: true });
  });
  it.each([
    ['without any dealing', { dealt: false }, 'no_dealing'],
    ['twice', { already: true }, 'already'],
  ])('no, %s', async (_l, opts, reason) => {
    expect(await svc(opts).canReviewAgent(GUEST._id, AGENT)).toEqual({ canReview: false, reason });
  });
  it('not yourself, and not a bad id', async () => {
    expect((await svc().canReviewAgent(AGENT, AGENT)).reason).toBe('self');
    expect((await svc().canReviewAgent(GUEST._id, 'nope')).reason).toBe('not_found');
  });
});
