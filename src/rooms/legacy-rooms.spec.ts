import { Types } from 'mongoose';
import { parseLegacyRooms } from './legacy-rooms.util';
import { RoomsService } from './rooms.service';

describe('parseLegacyRooms', () => {
  it('reads name, bed, price, guests and how many rooms', () => {
    expect(parseLegacyRooms(['hotel', 'stars:3', 'room:Suite Royale|King|45000|3|2'])).toEqual([
      { name: 'Suite Royale', roomType: 'suite', bedType: 'king', price: 45000, maxGuests: 3, quantity: 2 },
    ]);
  });

  it('fills what the old format left out, with safe values', () => {
    expect(parseLegacyRooms(['room:||abc||'])).toEqual([
      { name: 'Room', roomType: 'double', bedType: 'double', maxGuests: 2, quantity: 1 },
    ]);
  });

  it('understands French names and single beds', () => {
    const [simple, twin] = parseLegacyRooms(['room:Chambre simple|single|10000|1|5', 'room:Chambre jumelle|Sofa Bed|12000|2|1']);
    expect(simple.roomType).toBe('single');
    expect(twin).toEqual(expect.objectContaining({ roomType: 'twin', bedType: 'sofa_bed' }));
  });

  it('ignores anything that is not a room keyword', () => {
    expect(parseLegacyRooms(['yaoundé', 'total_rooms:12', 42 as any])).toEqual([]);
    expect(parseLegacyRooms(undefined)).toEqual([]);
  });
});

describe('RoomsService: older hotels become bookable', () => {
  const PID = new Types.ObjectId().toString();
  const chain = (v: any) => ({ lean: () => ({ exec: () => Promise.resolve(v) }) });

  function build(opts: { hasRooms?: boolean; claimed?: any; insertFails?: boolean } = {}) {
    const roomModel: any = {
      exists: jest.fn().mockResolvedValue(opts.hasRooms ? { _id: 'r' } : null),
      insertMany: jest.fn(() => (opts.insertFails ? Promise.reject(new Error('db down')) : Promise.resolve([]))),
      find: jest.fn(() => ({ sort: () => ({ exec: () => Promise.resolve([]) }) })),
    };
    const propertyModel: any = {
      findOneAndUpdate: jest.fn(() => chain(opts.claimed === undefined ? { keywords: ['room:Double|double|20000|2|4'] } : opts.claimed)),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomsService(roomModel, {} as any, propertyModel, {} as any);
    return { service, roomModel, propertyModel };
  }

  it('creates the rooms from the keywords the first time', async () => {
    const { service, roomModel } = build();
    await service.getRoomsByProperty(PID);
    expect(roomModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Double', price: 20000, quantity: 4, isActive: true, propertyId: new Types.ObjectId(PID) }),
    ]);
  });

  it('never touches a listing that already has rooms', async () => {
    const { service, roomModel, propertyModel } = build({ hasRooms: true });
    await service.getRoomsByProperty(PID);
    expect(propertyModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(roomModel.insertMany).not.toHaveBeenCalled();
  });

  it('runs once: a listing already claimed is left alone', async () => {
    const { service, roomModel, propertyModel } = build({ claimed: null });
    await service.getRoomsByProperty(PID);
    expect(propertyModel.findOneAndUpdate.mock.calls[0][0]).toEqual(expect.objectContaining({ legacyRoomsConvertedAt: { $exists: false } }));
    expect(roomModel.insertMany).not.toHaveBeenCalled();
  });

  it('a failure still returns the list, and lets a later request retry', async () => {
    const { service, propertyModel } = build({ insertFails: true });
    await expect(service.getRoomsByProperty(PID)).resolves.toEqual([]);
    expect(propertyModel.updateOne).toHaveBeenCalledWith(expect.anything(), { $unset: { legacyRoomsConvertedAt: 1 } }, expect.anything());
  });
});
