import { NotificationsService } from './notifications.service';
import { NotificationType } from './schemas/notification.schema';

const USER = '507f1f77bcf86cd799439091';
const dto: any = { userId: USER, type: NotificationType.SYSTEM, title: 'Payment received', message: 'Paid.' };
const fr = { title: 'Paiement reçu', message: 'Payé.' };

function build(appLanguage?: string) {
  const saved: any[] = [];
  const notificationModel: any = function (this: any, doc: any) {
    saved.push(doc);
    this.save = async () => ({ _id: { toString: () => 'n1' }, toObject: () => doc });
  };
  const userModel: any = { findById: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve({ appLanguage }) }) }) })) };
  const gateway: any = { sendNotificationToUser: jest.fn() };
  const push: any = { sendToUser: jest.fn() };
  const service = new NotificationsService(notificationModel, userModel, {} as any, gateway, push, {} as any);
  (service as any).wantsPush = jest.fn().mockResolvedValue(true);
  (service as any).pushImageFor = jest.fn().mockResolvedValue(undefined);
  return { service, saved, push };
}

describe('notifications in the app language', () => {
  it('a French app gets the French text, in the list and the push', async () => {
    const { service, saved, push } = build('fr');
    await service.create(dto, fr);
    expect(saved[0]).toEqual(expect.objectContaining({ title: 'Paiement reçu', message: 'Payé.' }));
    expect(push.sendToUser).toHaveBeenCalledWith(USER, expect.objectContaining({ title: 'Paiement reçu', body: 'Payé.' }));
  });

  it.each([['en'], [undefined]])('app language %s keeps the main text', async (lang) => {
    const { service, saved } = build(lang);
    await service.create(dto, fr);
    expect(saved[0].title).toBe('Payment received');
  });

  it('without a French version nothing is looked up', async () => {
    const { service, saved } = build('fr');
    await service.create(dto);
    expect(saved[0].title).toBe('Payment received');
  });

  it('the French version can also come on the notification itself, and is never saved', async () => {
    const { service, saved } = build('fr');
    await service.create({ ...dto, fr });
    expect(saved[0]).toEqual(expect.objectContaining({ title: 'Paiement reçu' }));
    expect(saved[0].fr).toBeUndefined();
  });

  it('a booking confirmation reaches a French guest in French', async () => {
    const { service, saved } = build('fr');
    await service.notifyBookingConfirmed(USER, { bookingId: 'b', propertyId: 'p', propertyTitle: 'Villa', hostName: 'Jo', checkIn: '2026-12-01', checkOut: '2026-12-03' });
    expect(saved[0].title).toBe('Réservation confirmée ! 🎉');
    expect(saved[0].message).toContain('Votre séjour à Villa est confirmé');
  });

  it('the guest request notice now has English for English apps', async () => {
    const { service, saved } = build('en');
    await service.notifyBookingRequest('', { guestId: USER, bookingId: 'b', propertyId: 'p', propertyTitle: 'Villa', guestName: 'Ana', checkIn: '2026-12-01', checkOut: '2026-12-03' });
    expect(saved[0].title).toBe('Booking request sent 📩');
  });
});
