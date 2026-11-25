import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { AppleAuth } from './apple-auth';
import { AuthService } from './auth.service';

const NONCE = 'a'.repeat(64);
const HASHED = crypto.createHash('sha256').update(NONCE).digest('hex');
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

const token = (claims: any = {}, options: any = {}, key: any = pair.privateKey) =>
  jwt.sign({ nonce: HASHED, email: 'Awa@Example.com', email_verified: 'true', ...claims }, key, {
    algorithm: 'RS256', keyid: 'k1', issuer: 'https://appleid.apple.com', audience: 'com.horohouse.app', subject: 'apple-1', expiresIn: '5m', ...options,
  });

function build() {
  const apple = new AppleAuth({ get: () => undefined } as any);
  const fetchKeys = jest.fn().mockResolvedValue([{ ...pair.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256' }]);
  (apple as any).fetchKeys = fetchKeys;
  (apple as any).logger = { warn: jest.fn() };
  return { apple, fetchKeys };
}

describe('AppleAuth.verify', () => {
  it('accepts a token Apple signed for this app and this sign-in', async () => {
    const { apple } = build();
    await expect(apple.verify(token(), NONCE)).resolves.toEqual({ appleId: 'apple-1', email: 'awa@example.com', emailVerified: true });
  });

  it.each([
    ['signed by someone else', () => token({}, {}, other.privateKey), NONCE],
    ['made for another app', () => token({}, { audience: 'com.other.app' }), NONCE],
    ['from another issuer', () => token({}, { issuer: 'https://evil.example' }), NONCE],
    ['expired', () => token({}, { expiresIn: '-1m' }), NONCE],
    ['made for another sign-in', () => token(), 'b'.repeat(64)],
    ['without a nonce', () => token({ nonce: undefined }), NONCE],
    ['not a token', () => 'x'.repeat(120), NONCE],
  ])('refuses one %s', async (_label, make, nonce) => {
    const { apple } = build();
    await expect(apple.verify(make(), nonce)).rejects.toThrow('could not be checked');
  });

  it('refuses a token that claims no signature or a shared-secret one', async () => {
    const { apple } = build();
    const claims = { nonce: HASHED, sub: 'x', iss: 'https://appleid.apple.com', aud: 'com.horohouse.app' };
    const hs = jwt.sign(claims, 'guess', { algorithm: 'HS256', keyid: 'k1' });
    const none = jwt.sign(claims, '', { algorithm: 'none', keyid: 'k1' } as any);
    await expect(apple.verify(hs, NONCE)).rejects.toThrow('could not be checked');
    await expect(apple.verify(none, NONCE)).rejects.toThrow('could not be checked');
  });

  it('fetches the keys once, and does not hammer Apple for unknown ones', async () => {
    const { apple, fetchKeys } = build();
    await apple.verify(token(), NONCE);
    await apple.verify(token(), NONCE);
    await expect(apple.verify(token({}, { keyid: 'k9' }), NONCE)).rejects.toThrow();
    expect(fetchKeys).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.appleSignIn', () => {
  const dto = { identityToken: 't', nonce: NONCE, name: 'Awa N.' };

  function auth(identity: any, users: any[]) {
    const found = (u: any) => ({ select: () => ({ exec: () => Promise.resolve(u ?? null) }) });
    const userModel: any = {
      findOne: jest.fn((q: any) => found(users.find((u) => (q.appleId ? u.appleId === q.appleId : new RegExp(q.email.$regex, 'i').test(u.email ?? ''))))),
      create: jest.fn(async (d: any) => ({ ...d, _id: 'new', toJSON: () => d })),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const email: any = { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) };
    const apple: any = { verify: jest.fn().mockResolvedValue(identity), refreshTokenFor: jest.fn().mockResolvedValue(null) };
    const service = new AuthService(userModel, {} as any, email, {} as any, {} as any, apple);
    (service as any).generateTokens = jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { service, userModel };
  }
  const account = (more: any = {}) => {
    const u: any = {
      _id: 'u1', email: 'awa@example.com', emailVerified: true, isActive: true, role: 'host', phoneNumber: '+237670000000',
      onboardingStatus: 'completed', sessions: [{ id: 's' }], save: jest.fn().mockResolvedValue(undefined), ...more,
    };
    u.toJSON = () => u;
    return u;
  };
  const identity = { appleId: 'apple-1', email: 'awa@example.com', emailVerified: true };

  it('makes an account that still has to finish sign-up', async () => {
    const { service, userModel } = auth(identity, []);
    const res = await service.appleSignIn(dto);
    expect(res.isNewUser).toBe(true);
    expect(userModel.create).toHaveBeenCalledWith(expect.objectContaining({
      appleId: 'apple-1', name: 'Awa N.', email: 'awa@example.com', onboardingStatus: 'not_started', role: 'registered_user',
    }));
  });

  it('works without an email, and never trusts an unverified one', async () => {
    const existing = account();
    const { service, userModel } = auth({ ...identity, emailVerified: false }, [existing]);
    await service.appleSignIn(dto);
    expect(existing.save).not.toHaveBeenCalled();
    expect(userModel.create.mock.calls[0][0].email).toBeUndefined();
  });

  it('links an existing account with the same verified email, keeping its role', async () => {
    const existing = account();
    const { service, userModel } = auth(identity, [existing]);
    const res = await service.appleSignIn(dto);
    expect(existing.appleId).toBe('apple-1');
    expect(existing.role).toBe('host');
    expect(res.isNewUser).toBe(false);
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('drops a password nobody proved they own when linking', async () => {
    const existing = account({ emailVerified: false, password: 'hash' });
    const { service } = auth(identity, [existing]);
    await service.appleSignIn(dto);
    expect(existing.password).toBeUndefined();
    expect(existing.sessions).toEqual([]);
  });

  it('refuses a deactivated account', async () => {
    const { service } = auth(identity, [account({ appleId: 'apple-1', isActive: false })]);
    await expect(service.appleSignIn(dto)).rejects.toThrow('deactivated');
  });
});
