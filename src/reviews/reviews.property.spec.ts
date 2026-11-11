import { ReviewType } from './schemas/review.schema';
import { ReviewsService } from './reviews.service';

const PROPERTY = '507f1f77bcf86cd799439091';
const GUEST: any = { _id: '507f1f77bcf86cd799439092' };
const DAY = 86_400_000;
const dto: any = { reviewType: ReviewType.PROPERTY, propertyId: PROPERTY, rating: 5, comment: 'Lovely place' };

function build(stays: any[]) {
  const bookingModel: any = {
    find: jest.fn(() => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: () => ({ exec: () => Promise.resolve(stays) }) }) }) }) })),
  };
  const service = new ReviewsService({} as any, {} as any, {} as any, bookingModel, {} as any, {} as any);
  const stayReview = jest.fn().mockResolvedValue({ _id: 'review' });
  (service as any).createBookingReview = stayReview;
  return { service, stayReview, bookingModel };
}
const stay = (id: string, daysAgo: number, over: any = {}) => ({ _id: id, checkOut: new Date(Date.now() - daysAgo * DAY), guestReviewLeft: false, ...over });

describe('property reviews', () => {
  it('nobody can review a place they never stayed at', async () => {
    const { service, stayReview } = build([]);
    await expect(service.create(dto, GUEST)).rejects.toThrow('after you have stayed');
    expect(stayReview).not.toHaveBeenCalled();
  });

  it('only counts this guest\'s completed stays at this place', async () => {
    const { service, bookingModel } = build([stay('b1', 1)]);
    await service.create(dto, GUEST);
    expect(bookingModel.find).toHaveBeenCalledWith(expect.objectContaining({ guestId: GUEST._id, status: 'completed' }));
  });

  it('becomes the stay review of the booking, with its rules', async () => {
    const { service, stayReview } = build([stay('b1', 1)]);
    await service.create(dto, GUEST);
    expect(stayReview).toHaveBeenCalledWith(expect.objectContaining({ reviewType: ReviewType.STAY, bookingId: 'b1', rating: 5 }), GUEST);
  });

  it('skips a stay already reviewed and uses the next open one', async () => {
    const { service, stayReview } = build([stay('b2', 1, { guestReviewLeft: true }), stay('b1', 5)]);
    await service.create(dto, GUEST);
    expect(stayReview).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'b1' }), GUEST);
  });

  it('refuses when every stay is reviewed or too old', async () => {
    const { service, stayReview } = build([stay('b2', 1, { guestReviewLeft: true }), stay('b1', 40)]);
    await expect(service.create(dto, GUEST)).rejects.toThrow('already reviewed');
    expect(stayReview).not.toHaveBeenCalled();
  });

  it('the window counts from the actual check-out when there is one', async () => {
    const { service, stayReview } = build([stay('b1', 40, { actualCheckOut: new Date(Date.now() - DAY) })]);
    await service.create(dto, GUEST);
    expect(stayReview).toHaveBeenCalledTimes(1);
  });

  it('needs a valid listing', async () => {
    await expect(build([]).service.create({ ...dto, propertyId: undefined }, GUEST)).rejects.toThrow('propertyId is required');
    await expect(build([]).service.create({ ...dto, propertyId: 'nope' }, GUEST)).rejects.toThrow('Invalid property');
  });
});
