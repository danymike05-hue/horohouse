import { ForbiddenException, SetMetadata } from '@nestjs/common';

/**
 * Team access: parts of the admin side a team member can be given, without making them
 * an admin. Admins (the owner) can do everything; a team member only what's ticked.
 *
 * On a route: @Roles(UserRole.ADMIN) @Area('listings') lets admins in, and team members
 * who have "listings". Several areas mean all of them are needed.
 */
export const TEAM_AREAS = [
  'listings',          // approve, reject, boost listings
  'users',             // see users and their details
  'verification',      // ID documents, verify hosts and identities
  'issues',            // guests' stay problems
  'reports',           // reported listings, community posts
  'support',           // answer the HoroHouse support chat
  'finance_view',      // commission, payouts, payments to review
  'finance_refunds',   // send refunds, decide on money (real money)
  'students',          // student cards, ambassadors, student homes
  'content',           // scholarships, language courses, articles
  'essentials',        // partner shops, kit orders
  'notifications',     // push and email to users
  'publish_for_host',  // set up listings for hosts
] as const;

export type TeamArea = (typeof TEAM_AREAS)[number];

export const AREA_KEY = 'teamAreas';

/** Which team areas may use this route (besides admins) */
export const Area = (...areas: TeamArea[]) => SetMetadata(AREA_KEY, areas);

export const isTeamArea = (a: unknown): a is TeamArea => TEAM_AREAS.includes(a as TeamArea);

const isAdmin = (user: any) => user?.role === 'admin';

/** True for the admin (owner), or a team member with every area named */
export function hasArea(user: any, ...areas: TeamArea[]): boolean {
  if (isAdmin(user)) return true;
  const mine: string[] = Array.isArray(user?.staffPermissions) ? user.staffPermissions : [];
  return areas.length > 0 && areas.every((a) => mine.includes(a));
}

/**
 * Refunds a team member can send on their own: up to this many XAF, with the amount
 * written out. A full refund, or more than this, goes to the owner (an admin).
 */
export const TEAM_REFUND_LIMIT_XAF = Number(process.env.TEAM_REFUND_LIMIT_XAF) > 0 ? Number(process.env.TEAM_REFUND_LIMIT_XAF) : 100_000;

export function assertCanRefund(user: any, amount?: number | null): void {
  if (isAdmin(user)) return;
  if (!hasArea(user, 'finance_refunds')) {
    throw new ForbiddenException({ message: 'Refunds need the "Finances, refunds" access.', code: 'TEAM_NO_REFUNDS' });
  }
  if (!amount || amount > TEAM_REFUND_LIMIT_XAF) {
    throw new ForbiddenException({
      message: `Refunds above ${TEAM_REFUND_LIMIT_XAF.toLocaleString('fr-FR')} XAF, and full refunds, are done by the owner.`,
      code: 'TEAM_REFUND_LIMIT',
      limit: TEAM_REFUND_LIMIT_XAF,
    });
  }
}
