import type { Session, User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        session: Session;
        user: User;
        rawToken: string;
      };
    }
  }
}

export {};
