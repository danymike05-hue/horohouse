import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, ROLES_KEY } from './guards/roles.guard';
import {
  AREA_KEY,
  assertCanRefund,
  hasArea,
  TEAM_REFUND_LIMIT_XAF,
} from './team-areas';
import { UserRole } from '../users/schemas/user.schema';

/** A request to a route needing `roles`, and team `areas` */
function check(user: any, roles: UserRole[] | undefined, areas?: string[]) {
  const meta: Record<string, any> = {
    [ROLES_KEY]: roles,
    [AREA_KEY]: areas,
    isPublic: false,
  };
  const reflector = {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;
  const ctx: any = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  try {
    return new RolesGuard(reflector).canActivate(ctx);
  } catch (e) {
    if (e instanceof ForbiddenException) return false;
    throw e;
  }
}

const admin = { role: UserRole.ADMIN };
const moderator = { role: 'host', staffPermissions: ['listings', 'reports'] };
const nobody = { role: 'host', staffPermissions: [] };

describe('team access', () => {
  it('the owner (an admin) can use every admin route', () => {
    expect(check(admin, [UserRole.ADMIN])).toBe(true);
    expect(check(admin, [UserRole.ADMIN], ['finance_refunds'])).toBe(true);
  });

  it('a team member can use the routes of their areas only', () => {
    expect(check(moderator, [UserRole.ADMIN], ['listings'])).toBe(true);
    expect(check(moderator, [UserRole.ADMIN], ['finance_view'])).toBe(false);
  });

  it('a route needing several areas needs them all', () => {
    expect(
      check(moderator, [UserRole.ADMIN], ['listings', 'finance_refunds']),
    ).toBe(false);
    expect(
      check(
        { role: 'guest', staffPermissions: ['essentials', 'finance_refunds'] },
        [UserRole.ADMIN],
        ['essentials', 'finance_refunds'],
      ),
    ).toBe(true);
  });

  it('owner-only routes (no area) stay closed to the team', () => {
    expect(check(moderator, [UserRole.ADMIN])).toBe(false);
  });

  it('people without team access get nothing, and normal routes are unchanged', () => {
    expect(check(nobody, [UserRole.ADMIN], ['listings'])).toBe(false);
    expect(
      check({ role: 'guest', staffPermissions: ['listings'] }, [
        UserRole.HOST,
        UserRole.ADMIN,
      ]),
    ).toBe(false);
    expect(
      check({ role: UserRole.HOST }, [UserRole.HOST, UserRole.ADMIN]),
    ).toBe(true);
    expect(check(nobody, undefined)).toBe(true);
  });

  it('hasArea follows the same rules', () => {
    expect(hasArea(admin, 'support')).toBe(true);
    expect(hasArea(moderator, 'listings')).toBe(true);
    expect(hasArea(moderator, 'support')).toBe(false);
    expect(hasArea(moderator)).toBe(false);
  });
});

describe('team refunds', () => {
  const finance = {
    role: 'guest',
    staffPermissions: ['finance_view', 'finance_refunds'],
  };

  it('the owner can refund any amount, or in full', () => {
    expect(() => assertCanRefund(admin, undefined)).not.toThrow();
    expect(() => assertCanRefund(admin, 10_000_000)).not.toThrow();
  });

  it('the team refunds up to the limit, with the amount written out', () => {
    expect(() => assertCanRefund(finance, TEAM_REFUND_LIMIT_XAF)).not.toThrow();
    expect(() => assertCanRefund(finance, TEAM_REFUND_LIMIT_XAF + 1)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanRefund(finance, undefined)).toThrow(
      ForbiddenException,
    );
  });

  it('no refunds without refund access', () => {
    expect(() =>
      assertCanRefund({ role: 'guest', staffPermissions: ['issues'] }, 5000),
    ).toThrow(ForbiddenException);
  });
});
