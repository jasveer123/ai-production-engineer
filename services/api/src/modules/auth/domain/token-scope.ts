export interface TokenGrant {
  id: string;
  workspaceId: string | null;
  scopes: string[];
  areas: string[];
}

export interface ScopedRequest {
  workspaceId: string | undefined;
  method: string;
  path: string;
}

export type ScopeDecision = 'allow' | 'wrong_workspace' | 'missing_scope' | 'outside_area';

const AREA_OF: Record<string, string> = {
  monitors: 'monitors',
  alerts: 'alerts',
  'alert-sources': 'alerts',
  'alert-routes': 'alerts',
  'log-alerts': 'alerts',
  incidents: 'incidents',
  oncall: 'oncall',
  'status-pages': 'status-pages',
};

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const INGEST_PATH = /\/alert-sources\/[^/]+\/(events|heartbeat\/ping)$/;

export function areaOf(path: string): string | null {
  const segment = /workspaces\/[^/]+\/([^/?]+)/.exec(path)?.[1];
  return segment ? (AREA_OF[segment] ?? null) : null;
}

export function decideTokenAccess(grant: TokenGrant, req: ScopedRequest): ScopeDecision {
  if (grant.workspaceId && req.workspaceId !== grant.workspaceId) return 'wrong_workspace';
  const method = req.method.toUpperCase();
  const isIngest = method === 'POST' && INGEST_PATH.test(req.path);
  const needed = isIngest ? 'ingest' : READ_METHODS.has(method) ? 'read' : 'write';
  const granted = grant.scopes.includes(needed) || (isIngest && grant.scopes.includes('write'));
  if (!granted) return 'missing_scope';
  if (grant.areas.length > 0 && !grant.areas.includes(areaOf(req.path) ?? ''))
    return 'outside_area';
  return 'allow';
}
