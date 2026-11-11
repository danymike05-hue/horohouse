import { Types } from 'mongoose';
import { countMentions, topicsOf } from './review-topics.util';
import { ReviewsService } from './reviews.service';

describe('"Guests mention" topics', () => {
  it('finds topics in English and French, ignoring accents and case', () => {
    expect(topicsOf('Très propre, hôte très accueillant et quartier calme')).toEqual(
      expect.arrayContaining(['cleanliness', 'hospitality', 'location', 'quiet']),
    );
    expect(topicsOf('Great LOCATION, spotless room, fast WiFi')).toEqual(['location', 'cleanliness', 'wifi']);
  });

  it('matches whole words where it matters: "ghost", "hostile" and "hospital" are not about the host', () => {
    expect(topicsOf('the ghost story')).not.toContain('hospitality');
    expect(topicsOf('a hostile neighbour, by the hospital')).not.toContain('hospitality');
    expect(topicsOf('Our host was lovely')).toContain('hospitality');
    expect(topicsOf('the night watchman was unfriendly')).toContain('security');
  });

  it('counts each review once per topic, most mentioned first', () => {
    expect(countMentions(['clean clean clean', 'very clean, friendly host', 'nice host'])).toEqual([
      { topic: 'cleanliness', count: 2 },
      { topic: 'hospitality', count: 2 },
    ]);
  });
});

describe('a listing\'s reviews', () => {
  const PID = new Types.ObjectId().toString();
  const day = (n: number) => new Date(Date.UTC(2026, 9, n));
  const rows = [
    { _id: 'a', rating: 5, comment: 'Short and sweet', createdAt: day(20), bookingId: new Types.ObjectId() },
    { _id: 'b', rating: 3, comment: 'The room was clean but the street was noisy at night, and the wifi kept dropping out every evening.', createdAt: day(10) },
    { _id: 'c', rating: 4, comment: 'Propreté impeccable, hôte très réactif.', createdAt: day(15) },
  ];

  function build() {
    const chain = (v: any) => ({ populate: () => ({ populate: () => ({ lean: () => ({ exec: () => Promise.resolve(v.map((x: any) => ({ ...x }))) }) }) }) });
    const reviewModel: any = { find: jest.fn(() => chain(rows)) };
    const bookingModel: any = {
      find: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve([{ _id: rows[0].bookingId, nights: 2, roomId: 'r1' }]) }) }) })),
    };
    const roomModel: any = { find: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve([{ _id: 'r1', name: 'Classic Room' }]) }) }) })) };
    return new ReviewsService(reviewModel, {} as any, {} as any, bookingModel, {} as any, {} as any, roomModel);
  }
  const ids = (res: any) => res.reviews.map((r: any) => r._id);

  it('most relevant: detailed reviews first, then the newest', async () => {
    expect(ids(await build().getPropertyReviews(PID))).toEqual(['b', 'a', 'c']);
  });

  it('can sort by most recent, highest and lowest', async () => {
    expect(ids(await build().getPropertyReviews(PID, { sort: 'recent' }))).toEqual(['a', 'c', 'b']);
    expect(ids(await build().getPropertyReviews(PID, { sort: 'highest' }))).toEqual(['a', 'c', 'b']);
    expect(ids(await build().getPropertyReviews(PID, { sort: 'lowest' }))).toEqual(['b', 'c', 'a']);
  });

  it('searches the text without caring about accents', async () => {
    const res = await build().getPropertyReviews(PID, { q: 'proprete' });
    expect(ids(res)).toEqual(['c']);
    expect(res.total).toBe(1);
  });

  it('filters by a "Guests mention" topic', async () => {
    expect(ids(await build().getPropertyReviews(PID, { topic: 'cleanliness', sort: 'recent' }))).toEqual(['c', 'b']);
  });

  it('says how long the stay was and in which room', async () => {
    const res = await build().getPropertyReviews(PID, { sort: 'recent' });
    expect(res.reviews[0].stay).toEqual({ nights: 2, roomName: 'Classic Room' });
    expect(res.reviews[1].stay).toBeUndefined();
  });

  it('pages through the results', async () => {
    const res = await build().getPropertyReviews(PID, { sort: 'recent', limit: 2, page: 2 });
    expect(ids(res)).toEqual(['b']);
    expect(res.totalPages).toBe(2);
  });
});
