import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { CheckoutController } from './checkout.controller';

// Every checkout route needs a signed-in user, except CamerPay's signed webhook and the
// browser return redirect. (A misplaced decorator once left POST /checkout/payments open,
// and every payment failed with a 500.)
describe('Checkout routes require sign-in', () => {
  const PUBLIC = new Set(['webhook', 'returnFromProvider']);
  const proto = CheckoutController.prototype as any;
  const routes = Object.getOwnPropertyNames(proto).filter(
    (k) => k !== 'constructor' && typeof proto[k] === 'function' && Reflect.getMetadata('path', proto[k]) !== undefined,
  );

  it('finds the routes', () => {
    expect(routes).toEqual(expect.arrayContaining(['quote', 'create', 'get', 'cancel', 'storePurchase']));
  });

  it.each(routes.filter((r) => !PUBLIC.has(r)))('%s is guarded', (name) => {
    const guards: any[] = Reflect.getMetadata(GUARDS_METADATA, proto[name]) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });
});
