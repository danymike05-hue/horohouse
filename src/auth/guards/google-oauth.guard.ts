import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const q = (request.query as any) || {};

    // On the callback Google sends ?code=…&state=…; passport reads that itself.
    if (q.code) return {};

    // Start of sign-in: the app's return link (deep link with its PKCE
    // challenge). The app sends it as ?state=; older builds used ?redirectUri=.
    // It is only passed through here — the callback checks it against the
    // allowlist (AuthService.resolveOAuthRedirect) before using it.
    const raw = typeof q.state === 'string' ? q.state : typeof q.redirectUri === 'string' ? q.redirectUri : undefined;
    const state = raw && raw.length <= 2048 ? raw : undefined;
    return state ? { state } : {};
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    // Convert Fastify's response methods to Express-style for Passport compatibility
    // We need to cast to 'any' to add these methods dynamically
    const res = response as any;

    if (!res.setHeader) {
      res.setHeader = (name: string, value: string | string[]) => {
        response.header(name, value);
        return response;
      };
    }

    if (!res.end) {
      res.end = (data?: any) => {
        return response.send(data);
      };
    }

    if (!res.redirect) {
      res.redirect = (statusOrUrl: number | string, url?: string) => {
        if (typeof statusOrUrl === 'string') {
          // redirect(url) - default to 302
          return response.redirect(statusOrUrl);
        } else {
          // redirect(status, url)
          return response.redirect(url!);
        }
      };
    }

    void request;
    const activate = (await super.canActivate(context)) as boolean;
    return activate;
  }
}
