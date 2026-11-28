import { ConsoleLogger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { maskPersonal, SENTRY_ON } from '../instrument';

// Errors that the code catches itself (a scheduled job that failed, a payout that couldn't be
// sent, a webhook that broke) are only written to the log with this.logger.error(...): nobody
// saw them. This sends them to Sentry as well. Request errors are already sent by Sentry's own
// filter (ExceptionsHandler), and Bootstrap only logs refused form fields, so both are skipped.
const SKIP = new Set(['ExceptionsHandler', 'Bootstrap']);

export class SentryLogger extends ConsoleLogger {
  error(message: any, ...rest: any[]) {
    super.error(message, ...rest);
    if (!SENTRY_ON) return;
    try {
      const context = rest.length && typeof rest[rest.length - 1] === 'string' ? rest[rest.length - 1] : undefined;
      if (context && SKIP.has(context)) return;
      const stack = rest.length >= 2 && typeof rest[0] === 'string' ? rest[0] : undefined;
      const text = maskPersonal(message instanceof Error ? message.message : String(message));
      Sentry.withScope((scope) => {
        if (context) scope.setTag('context', context);
        if (stack) scope.setExtra('stack', maskPersonal(stack));
        if (message instanceof Error) Sentry.captureException(message);
        else Sentry.captureMessage(text, 'error');
      });
    } catch {
      // never let reporting break logging
    }
  }
}
