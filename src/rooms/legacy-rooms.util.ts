import { BedType, RoomType } from './schemas/room.schema';

/**
 * Older hotel listings kept their rooms as keywords, one per room type:
 *   "room:<name>|<bedType>|<price>|<maxGuests>|<quantity>"
 * The listing page showed them, but bookings need real room records, so nobody could
 * book these hotels. This turns the keywords into room records.
 */
export interface LegacyRoom {
  name: string;
  roomType: RoomType;
  bedType: BedType;
  price?: number;
  maxGuests: number;
  quantity: number;
}

const BED_ALIASES: Record<string, BedType> = {
  single: BedType.SINGLE,
  double: BedType.DOUBLE,
  queen: BedType.QUEEN,
  king: BedType.KING,
  bunk: BedType.BUNK,
  sofa: BedType.SOFA,
  sofa_bed: BedType.SOFA,
  'sofa bed': BedType.SOFA,
  sofabed: BedType.SOFA,
};

/** Room type from the room's name when it says one, else from the bed. */
function roomTypeOf(name: string, bed: BedType): RoomType {
  const n = name.toLowerCase();
  if (/suite/.test(n)) return RoomType.SUITE;
  if (/penthouse/.test(n)) return RoomType.PENTHOUSE;
  if (/deluxe|luxe/.test(n)) return RoomType.DELUXE;
  if (/famil/.test(n)) return RoomType.FAMILY;
  if (/studio/.test(n)) return RoomType.STUDIO;
  if (/dorm/.test(n)) return RoomType.DORMITORY;
  if (/twin|jumel/.test(n)) return RoomType.TWIN;
  if (/single|simple|individ/.test(n) || bed === BedType.SINGLE) return RoomType.SINGLE;
  return RoomType.DOUBLE;
}

const whole = (v: string | undefined) => {
  const n = parseInt((v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : NaN;
};

export function parseLegacyRooms(keywords: unknown): LegacyRoom[] {
  if (!Array.isArray(keywords)) return [];
  const rooms: LegacyRoom[] = [];
  for (const kw of keywords) {
    if (typeof kw !== 'string' || !kw.startsWith('room:')) continue;
    const [rawName, rawBed, rawPrice, rawGuests, rawQty] = kw.slice(5).split('|');
    const name = (rawName ?? '').trim() || 'Room';
    const bedType = BED_ALIASES[(rawBed ?? '').trim().toLowerCase()] ?? BedType.DOUBLE;
    const price = whole(rawPrice);
    const guests = whole(rawGuests);
    const qty = whole(rawQty);
    rooms.push({
      name: name.slice(0, 100),
      roomType: roomTypeOf(name, bedType),
      bedType,
      // No price: the room uses the listing's price, as the old listing page did.
      ...(price > 0 ? { price } : {}),
      maxGuests: guests >= 1 ? guests : 2,
      quantity: qty >= 1 ? qty : 1,
    });
  }
  return rooms;
}
