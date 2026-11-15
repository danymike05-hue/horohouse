import { Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';

/** Fields needed to tell whether a session is still alive */
export const SESSION_FIELDS = 'isActive sessions.id sessions.isActive sessions.expiresAt';

/** Same rule as AuthService.validateUser: the user is active and this session exists, is active and unexpired */
export function hasLiveSession(user: any, sessionId?: string): boolean {
  if (!user || user.isActive === false || !sessionId) return false;
  const now = Date.now();
  return (user.sessions ?? []).some(
    (s: any) => s?.id === sessionId && s.isActive && (!s.expiresAt || new Date(s.expiresAt).getTime() > now),
  );
}

export async function sessionIsLive(userModel: Model<any>, userId?: string, sessionId?: string): Promise<boolean> {
  if (!userId || !Types.ObjectId.isValid(userId)) return false;
  const user = await userModel.findById(userId).select(SESSION_FIELDS).lean();
  return hasLiveSession(user, sessionId);
}

/**
 * A socket checks its token once, when it connects. Signing out, changing the password or
 * ending a device's session only removes the session from the database, so live sockets
 * kept receiving messages until the token expired. This sweep disconnects them.
 * One query per sweep for all connected users.
 */
export function startSessionSweep(opts: {
  getServer: () => any;
  userModel: Model<any>;
  sessionOf: (socket: any) => { userId?: string; sessionId?: string };
  logger: Logger;
  everyMs?: number;
}): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const server = opts.getServer();
      if (!server?.fetchSockets) return;
      const sockets: any[] = await server.fetchSockets();
      if (!sockets.length) return;
      const ids = [...new Set(sockets.map((s) => opts.sessionOf(s).userId).filter((id): id is string => !!id && Types.ObjectId.isValid(id)))];
      const users = await opts.userModel.find({ _id: { $in: ids } }).select(SESSION_FIELDS).lean();
      const byId = new Map(users.map((u: any) => [String(u._id), u]));
      let cut = 0;
      for (const s of sockets) {
        const { userId, sessionId } = opts.sessionOf(s);
        if (!hasLiveSession(userId ? byId.get(userId) : null, sessionId)) {
          s.emit?.('session:ended', { reason: 'signed_out' });
          s.disconnect(true);
          cut++;
        }
      }
      if (cut) opts.logger.log(`Disconnected ${cut} socket(s) whose session ended`);
    } catch (err: any) {
      opts.logger.warn(`Session sweep failed: ${err?.message}`);
    }
  }, opts.everyMs ?? 60_000);
  timer.unref?.();
  return timer;
}
