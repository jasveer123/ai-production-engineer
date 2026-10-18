import type { Role } from '@ape/api-contracts';

export interface AuthContext {
  userId: string;
  sessionId: string;
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
      /** Exact request bytes, kept for webhook signature checks. */
      rawBody?: Buffer;
    }
  }
}

/** Who is acting, in which workspace, for which request. Passed from controllers to services. */
export interface ActorContext {
  userId: string;
  workspaceId: string;
  role: Role;
  correlationId: string;
}
