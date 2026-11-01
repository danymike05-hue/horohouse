import { User } from '../users/schemas/user.schema';

// Augment Express.Request to include the `user` property set by Passport/Nest AuthGuard
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
