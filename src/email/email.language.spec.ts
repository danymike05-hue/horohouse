import { EmailService } from './email.service';

function build(appLanguage?: string, found = true) {
  const config: any = { get: (_k: string, d?: any) => d };
  const userModel: any = {
    findOne: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(found ? { appLanguage } : null) }) }) })),
  };
  const service = new EmailService(config, userModel);
  const sent: any[] = [];
  (service as any).safeSendMail = jest.fn(async (o: any) => { sent.push(o); });
  return { service, sent, userModel };
}

describe('emails in the recipient app language', () => {
  it('a French app gets a French email, subject, HTML and text', async () => {
    const { service, sent, userModel } = build('fr');
    await service.sendBookingConfirmationEmail('Ana@Example.com', 'Ana', {
      propertyTitle: 'Villa', checkIn: '2026-12-01', checkOut: '2026-12-03', nights: 2, totalAmount: 50000, currency: 'XAF', bookingId: 'b1',
    });
    expect(userModel.findOne).toHaveBeenCalledWith({ email: 'ana@example.com' });
    expect(sent[0].subject).toBe('Réservation confirmée — Villa');
    expect(sent[0].html).toContain('Votre réservation est confirmée !');
    expect(sent[0].html).toContain('Bonjour Ana,');
    expect(sent[0].html).toContain('Arrivée');
    expect(sent[0].text).toContain('Arrivée : 2026-12-01');
  });

  it.each([['en'], [undefined]])('app language %s stays in English', async (lang) => {
    const { service, sent } = build(lang);
    await service.sendPasswordResetEmail('a@b.co', 'Ana', 'tok');
    expect(sent[0].subject).toBe('Reset Your HoroHouse Password');
    expect(sent[0].html).toContain('Hi Ana,');
  });

  it('an address that is not an account gets English', async () => {
    const { service, sent } = build(undefined, false);
    await service.sendNewsletterWelcome('new@reader.co');
    expect(sent[0].subject).toBe('Welcome to the HoroHouse Newsletter!');
  });

  it('no name: a natural French greeting', async () => {
    const { service, sent } = build('fr');
    await service.sendWelcomeEmail('a@b.co');
    expect(sent[0].html).toContain('Bienvenue !');
    expect(sent[0].text).toMatch(/^Bonjour,\n/);
  });

  it('an admin message keeps its own words; only the frame is translated', async () => {
    const { service, sent } = build('fr');
    await service.sendAdminNotificationEmail('a@b.co', 'Ana', 'Maintenance tonight', 'We will be down at 2am.', '/news');
    expect(sent[0].subject).toBe('Maintenance tonight — HoroHouse');
    expect(sent[0].html).toContain('We will be down at 2am.');
    expect(sent[0].html).toContain('Voir les détails');
  });

  it('a failed lookup still sends, in English', async () => {
    const { service, sent, userModel } = build('fr');
    userModel.findOne.mockImplementation(() => { throw new Error('db down'); });
    await service.sendWelcomeEmail('a@b.co', 'Ana');
    expect(sent[0].subject).toBe('Welcome to HoroHouse!');
  });
});
