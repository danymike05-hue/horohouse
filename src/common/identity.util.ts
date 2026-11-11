/**
 * There are two ways to be verified: an admin approving the ID uploaded in the app
 * (identityVerification), and the older host verification (hostProfile.verificationStatus).
 * Everything that shows or relies on "verified" has to count both.
 */
export function isIdentityVerified(user: any): boolean {
  return user?.identityVerification?.status === 'verified' || user?.hostProfile?.verificationStatus === 'verified';
}
