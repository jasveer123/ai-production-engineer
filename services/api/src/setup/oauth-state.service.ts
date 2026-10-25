import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { ApiException } from '../common/errors';
import type { ActorContext } from '../common/request-context';

export type SetupProvider = 'github' | 'sentry' | 'vercel' | 'heroku';

interface StatePayload {
  typ: 'setup_state';
  ws: string;
  uid: string;
  prv: SetupProvider;
  n: string;
}

/**
 * The `state` carried through a third-party redirect. Signed and short-lived, and bound to the
 * workspace, the user who started it and the provider, so a callback cannot be replayed into
 * another workspace or by another person (CSRF / account mix-up).
 */
@Injectable()
export class OAuthStateService {
  constructor(private readonly jwt: JwtService) {}

  issue(actor: ActorContext, provider: SetupProvider): Promise<string> {
    const payload: StatePayload = {
      typ: 'setup_state',
      ws: actor.workspaceId,
      uid: actor.userId,
      prv: provider,
      n: randomBytes(8).toString('hex'),
    };
    return this.jwt.signAsync(payload, { expiresIn: 30 * 60 });
  }

  /** Checks the state belongs to this user, this workspace and this provider. */
  async verify(
    actor: ActorContext,
    provider: SetupProvider,
    state: string | undefined,
  ): Promise<void> {
    let p: StatePayload | null = null;
    try {
      p = state ? await this.jwt.verifyAsync<StatePayload>(state) : null;
    } catch {
      p = null;
    }
    if (
      !p ||
      p.typ !== 'setup_state' ||
      p.prv !== provider ||
      p.ws !== actor.workspaceId ||
      p.uid !== actor.userId
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'invalid_state',
        'This setup link expired or was started by someone else. Start the connection again from the integrations page.',
      );
    }
  }
}
