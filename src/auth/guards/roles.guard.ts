import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/schemas/user.schema';
import { AREA_KEY, TeamArea } from '../team-areas';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ✅ ADD THIS: Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // Allow public access without checking roles
    }

    // Check required roles
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);

    // A team member with the route's area(s) may use an admin route (see team-areas.ts)
    if (!hasRole && requiredRoles.includes(UserRole.ADMIN)) {
      const areas = this.reflector.getAllAndOverride<TeamArea[]>(AREA_KEY, [context.getHandler(), context.getClass()]);
      const mine: string[] = Array.isArray(user.staffPermissions) ? user.staffPermissions : [];
      if (areas?.length && areas.every((a) => mine.includes(a))) return true;
    }

    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}

// Decorator to set required roles
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Decorator to make routes public (skip JWT authentication)
export const Public = () => SetMetadata('isPublic', true);