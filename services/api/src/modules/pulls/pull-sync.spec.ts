import { createHmac } from 'node:crypto';
import { verifyGitHubSignature } from './github-webhook.controller';
import { summarizeChecks } from './application/pull-sync.service';

describe('summarizeChecks', () => {
  const run = (status: string, conclusion: string | null) => ({ status, conclusion });
  it('rolls check runs up into one status', () => {
    expect(summarizeChecks([])).toBe('none');
    expect(summarizeChecks([run('completed', 'success'), run('completed', 'skipped')])).toBe(
      'passing',
    );
    expect(summarizeChecks([run('completed', 'success'), run('in_progress', null)])).toBe(
      'pending',
    );
    expect(summarizeChecks([run('in_progress', null), run('completed', 'failure')])).toBe(
      'failing',
    );
  });
});

describe('verifyGitHubSignature', () => {
  const body = Buffer.from('{"action":"closed"}');
  const sig = `sha256=${createHmac('sha256', 'secret-1234567890').update(body).digest('hex')}`;
  it('accepts the exact signature and rejects anything else', () => {
    expect(verifyGitHubSignature('secret-1234567890', sig, body)).toBe(true);
    expect(verifyGitHubSignature('other-secret-12345', sig, body)).toBe(false);
    expect(verifyGitHubSignature('secret-1234567890', sig, Buffer.from('{}'))).toBe(false);
    expect(verifyGitHubSignature('secret-1234567890', undefined, body)).toBe(false);
    expect(verifyGitHubSignature('secret-1234567890', 'sha256=00', body)).toBe(false);
  });
});
