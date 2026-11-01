import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    // Read the redirectUri from the query params if provided
    const redirectUri = (request.query as any)?.redirectUri;
    return {
      state: redirectUri,
    };
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

    const activate = (await super.canActivate(context)) as boolean;
    return activate;
  }
}