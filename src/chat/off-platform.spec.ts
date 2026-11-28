import { offPlatformReason } from './off-platform';

describe('offPlatformReason', () => {
  it.each([
    ['Call me on 699 12 34 56', 'phone'],
    ['+237 6 99 12 34 56', 'phone'],
    ['00237699123456', 'phone'],
    ['my number 677-123-456', 'phone'],
    ['+33 6 12 34 56 78', 'phone'],
    ['write to me at host.name@gmail.com', 'email'],
    ['Add me on WhatsApp', 'whatsapp'],
    ['wa.me/237699', 'whatsapp'],
    ['Send the deposit by MoMo', 'pay_outside'],
    ['Orange Money is easier', 'pay_outside'],
    ['pay me directly please', 'pay_outside'],
    ['Payez-moi directement', 'pay_outside'],
    ['on peut faire hors de l’application', 'pay_outside'],
  ])('flags %s', (text, reason) => {
    expect(offPlatformReason(text)).toBe(reason);
  });

  it.each([
    'Is the flat still free for 12/12/2026?',
    'The price is 650 000 000 FCFA',
    'It costs 25000 XAF a night',
    'We are 4 guests, arriving at 14:30',
    'Room 203, floor 2',
    '',
  ])('leaves %s alone', (text) => {
    expect(offPlatformReason(text)).toBeNull();
  });
});
