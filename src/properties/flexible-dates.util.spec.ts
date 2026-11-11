import { bookedIdsPerWindow, firstOpenWindow, parseFlexDays, stayWindows } from './flexible-dates.util';

const d = (key: string) => new Date(`${key}T00:00:00Z`);
const NOW = d('2027-01-01');
const key = (w: { checkIn: Date }) => w.checkIn.toISOString().slice(0, 10);

describe('parseFlexDays', () => {
  it('only accepts the offered choices', () => {
    expect([1, '2', 3, '7'].map(parseFlexDays)).toEqual([1, 2, 3, 7]);
    expect([0, 4, 30, -1, 'x', undefined, null].map(parseFlexDays)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('stayWindows', () => {
  it('exact dates only when not flexible', () => {
    expect(stayWindows(d('2027-02-10'), d('2027-02-13'), 0, NOW).map(key)).toEqual(['2027-02-10']);
  });

  it('asked-for dates first, then nearest, keeping the length', () => {
    const windows = stayWindows(d('2027-02-10'), d('2027-02-13'), 2, NOW);
    expect(windows.map(key)).toEqual(['2027-02-10', '2027-02-11', '2027-02-09', '2027-02-12', '2027-02-08']);
    for (const w of windows) expect(w.checkOut.getTime() - w.checkIn.getTime()).toBe(3 * 86_400_000);
  });

  it('never offers a stay starting in the past', () => {
    expect(stayWindows(d('2027-01-02'), d('2027-01-04'), 3, NOW).map(key)).toEqual([
      '2027-01-02', '2027-01-03', '2027-01-01', '2027-01-04', '2027-01-05',
    ]);
  });
});

describe('firstOpenWindow', () => {
  const windows = stayWindows(d('2027-02-10'), d('2027-02-13'), 1, NOW);

  it('prefers the dates asked for', () => {
    expect(key(firstOpenWindow(windows, [], [])!)).toBe('2027-02-10');
  });

  it('moves when a booking is in the way, and check-out day does not clash', () => {
    const booked = [{ checkIn: d('2027-02-08'), checkOut: d('2027-02-11') }];
    expect(key(firstOpenWindow(windows, booked, [])!)).toBe('2027-02-11');
  });

  it('moves when the host blocked those nights', () => {
    const blocked = [{ from: d('2027-02-12'), to: d('2027-02-13') }];
    expect(key(firstOpenWindow(windows, [], blocked)!)).toBe('2027-02-09');
  });

  it('nothing when every option is taken', () => {
    const booked = [{ checkIn: d('2027-02-01'), checkOut: d('2027-03-01') }];
    expect(firstOpenWindow(windows, booked, [])).toBeNull();
  });
});

describe('bookedIdsPerWindow', () => {
  it('a listing booked for one option can still be free for another', () => {
    const windows = stayWindows(d('2027-02-10'), d('2027-02-13'), 1, NOW);
    const result = bookedIdsPerWindow(windows, [{ propertyId: 'a', checkIn: d('2027-02-08'), checkOut: d('2027-02-11') }]);
    expect(result).toEqual([['a'], [], ['a']]);
  });
});
