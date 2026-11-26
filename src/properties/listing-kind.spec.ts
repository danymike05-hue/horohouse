import { listingKindQuery } from './properties.service';

describe('listingKindQuery', () => {
  it('keeps the kinds the app asks for', () => {
    expect(listingKindQuery({ listingType: 'short_term', propertyType: 'hotel' })).toEqual({ listingType: 'short_term', type: 'hotel' });
    expect(listingKindQuery({ isStudentFriendly: true })).toEqual({ isStudentFriendly: true });
  });

  it('filters nothing for older apps, which send no kind', () => {
    expect(listingKindQuery({})).toEqual({});
    expect(listingKindQuery({ isStudentFriendly: false })).toEqual({});
  });

  it('ignores values that aren’t a kind of listing', () => {
    expect(listingKindQuery({ listingType: 'anything', propertyType: { $ne: null } as any })).toEqual({});
  });
});
