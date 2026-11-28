// Error reporting (Sentry). Imported first in main.ts so it can watch everything that loads after.
// Off unless SENTRY_DSN is set. Errors only by default; SENTRY_TRACES_RATE (0 to 1) turns on
// speed tracing for that share of requests.
//
// Privacy: no IP addresses, cookies, tokens or request bodies are sent, and emails and phone
// numbers in error text are masked before anything leaves the server.
import * as Sentry from '@sentry/nestjs';

export const SENTRY_ON = !!process.env.SENTRY_DSN;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE = /\+?\d[\d\s.-]{7,}\d/g;
export function maskPersonal(text: string): string {
  return text.replace(EMAIL, '[email]').replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 9 ? '[phone]' : m));
}

if (SENTRY_ON) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
    // Collect as little as possible: no user details, cookies, bodies or query strings
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ['user-agent', 'content-type', 'accept-language'] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: Math.min(1, Math.max(0, Number(process.env.SENTRY_TRACES_RATE ?? 0) || 0)),
    beforeSend(event) {
      if (event.request) {
        const headers = { ...(event.request.headers ?? {}) };
        for (const key of Object.keys(headers)) {
          if (/authorization|cookie|x-camerpay-signature|token/i.test(key)) delete headers[key];
        }
        event.request.headers = headers;
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.query_string) event.request.query_string = '[removed]';
      }
      // Who it happened to: the account id only
      if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : undefined;
      if (event.message) event.message = maskPersonal(event.message);
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = maskPersonal(ex.value);
      }
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.message) crumb.message = maskPersonal(crumb.message);
      return crumb;
    },
  });
}
