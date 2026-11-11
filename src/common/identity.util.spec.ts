import { isIdentityVerified } from './identity.util';

describe('isIdentityVerified', () => {
  it('counts an ID approved by an admin', () => {
    expect(isIdentityVerified({ identityVerification: { status: 'verified' }, hostProfile: { verificationStatus: 'unverified' } })).toBe(true);
    expect(isIdentityVerified({ identityVerification: { status: 'verified' } })).toBe(true);
  });

  it('counts the older host verification', () => {
    expect(isIdentityVerified({ hostProfile: { verificationStatus: 'verified' } })).toBe(true);
  });

  it('does not count anything else', () => {
    for (const status of ['pending', 'rejected', 'unverified']) {
      expect(isIdentityVerified({ identityVerification: { status }, hostProfile: { verificationStatus: status } })).toBe(false);
    }
    expect(isIdentityVerified({})).toBe(false);
    expect(isIdentityVerified(null)).toBe(false);
  });
});
