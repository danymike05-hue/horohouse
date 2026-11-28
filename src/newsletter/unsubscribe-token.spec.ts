import { isValidUnsubscribeToken, unsubscribeToken } from './unsubscribe-token';

describe('newsletter unsubscribe token', () => {
  const before = process.env.NEWSLETTER_SECRET;
  beforeAll(() => {
    process.env.NEWSLETTER_SECRET = 'test-secret';
  });
  afterAll(() => {
    process.env.NEWSLETTER_SECRET = before;
  });

  it('accepts the token made for that email, whatever its case', () => {
    expect(
      isValidUnsubscribeToken(
        'Ada@Example.com',
        unsubscribeToken('ada@example.com'),
      ),
    ).toBe(true);
  });

  it('refuses a missing, wrong or other-email token', () => {
    expect(isValidUnsubscribeToken('ada@example.com', '')).toBe(false);
    expect(isValidUnsubscribeToken('ada@example.com', 'abc')).toBe(false);
    expect(
      isValidUnsubscribeToken(
        'ada@example.com',
        unsubscribeToken('bob@example.com'),
      ),
    ).toBe(false);
  });

  it('refuses everything when no secret is set', () => {
    const t = unsubscribeToken('ada@example.com');
    delete process.env.NEWSLETTER_SECRET;
    const jwt = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(isValidUnsubscribeToken('ada@example.com', t)).toBe(false);
    process.env.JWT_SECRET = jwt;
    process.env.NEWSLETTER_SECRET = 'test-secret';
  });
});
