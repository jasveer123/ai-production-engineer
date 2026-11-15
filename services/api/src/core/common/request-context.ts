import type { Role } from '@ape/api-contracts';

export interface AuthContext {
  userId: string;
  sessionId: string;
  token?: { id: string; workspaceId: string | null; scopes: string[]; areas: string[] };
}

export interface MembershipContext {
  workspaceId: string;
  memberId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      auth?: AuthContext;
      membership?: MembershipContext;

      rawBody?: Buffer;
    }
  }
}

export interface ActorContext {
  userId: string;
  workspaceId: string;
  role: Role;
  correlationId: string;
}
