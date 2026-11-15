import { decideTokenAccess, type TokenGrant } from './domain/token-scope';

const WS_A = '11111111-1111-4111-8111-111111111111';
const WS_B = '22222222-2222-4222-8222-222222222222';
const grant = (over: Partial<TokenGrant> = {}): TokenGrant => ({
  id: 't1',
  workspaceId: WS_A,
  scopes: ['read'],
  areas: [],
  ...over,
});
const req = (method: string, path: string, workspaceId = WS_A) => ({ method, path, workspaceId });

describe('API token scopes', () => {
  it('refuses a token from another workspace on every method', () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'])
      expect(
        decideTokenAccess(
          grant({ scopes: ['read', 'write', 'ingest'] }),
          req(method, `/api/v1/workspaces/${WS_B}/monitors`, WS_B),
        ),
      ).toBe('wrong_workspace');
  });

  it('separates read, write and ingest-only tokens', () => {
    const path = `/api/v1/workspaces/${WS_A}/incidents`;
    expect(decideTokenAccess(grant(), req('GET', path))).toBe('allow');
    expect(decideTokenAccess(grant(), req('POST', path))).toBe('missing_scope');
    expect(decideTokenAccess(grant({ scopes: ['write'] }), req('POST', path))).toBe('allow');
    const ingest = grant({ scopes: ['ingest'] });
    expect(decideTokenAccess(ingest, req('GET', path))).toBe('missing_scope');
    expect(
      decideTokenAccess(ingest, req('POST', `/api/v1/workspaces/${WS_A}/alert-sources/s1/events`)),
    ).toBe('allow');
  });

  it('limits a token to the areas it was given', () => {
    const oncallOnly = grant({ areas: ['oncall'] });
    expect(decideTokenAccess(oncallOnly, req('GET', `/workspaces/${WS_A}/oncall/now`))).toBe(
      'allow',
    );
    expect(decideTokenAccess(oncallOnly, req('GET', `/workspaces/${WS_A}/monitors`))).toBe(
      'outside_area',
    );
  });
});
