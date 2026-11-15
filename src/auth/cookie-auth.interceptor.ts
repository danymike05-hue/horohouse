import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Website cookie mode. The auth routes already put the tokens in httpOnly cookies; when the
 * website asks with "X-Auth-Mode: cookie" the tokens are also taken out of the JSON body,
 * so page scripts never see them (an injected script can't steal what it can't read).
 * The mobile app doesn't send the header and keeps getting tokens in the body.
 */
@Injectable()
export class CookieAuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const cookieMode = String(req?.headers?.['x-auth-mode'] ?? '').toLowerCase() === 'cookie';
    if (!cookieMode) return next.handle();
    return next.handle().pipe(
      map((body: any) => {
        if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
        if (!('accessToken' in body) && !('refreshToken' in body)) return body;
        const { accessToken, refreshToken, ...rest } = body;
        return { ...rest, cookieSession: true };
      }),
    );
  }
}
