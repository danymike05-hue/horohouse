import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // For public routes, try to authenticate but don't fail if no token
      // This allows optional authentication
      return super.canActivate(context);
    }

    // For protected routes, authentication is required
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // For public routes:
      // - If there's a valid token, attach the user
      // - If there's no token or it's invalid, just return null (don't throw error)
      if (err || !user) {
        // No user or error, but that's OK for public routes
        return null; // Return null instead of throwing
      }
      return user; // Token was valid, attach user
    }

    // For protected routes, throw error if authentication fails
    if (err || !user) {
      throw err || new UnauthorizedException('Access token required');
    }
    
    return user;
  }
}