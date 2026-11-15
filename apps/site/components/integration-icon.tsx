import { Waypoints } from 'lucide-react';
import { asset } from '@/data/base-path';
const assets: Record<string, string> = {
  opentelemetry: 'opentelemetry',
  docker: 'docker',
  kubernetes: 'kubernetes',
  ubuntu: 'linux-server',
  aws: 'cloud',
  'fluent-bit': 'fluent-bit',
  javascript: 'javascript',
  python: 'python',
  http: 'http-request',
};
export function IntegrationIcon({ id }: { id: string }) {
  return (
    <span className="integration-initial" aria-hidden="true">
      {id === 'vector' ? (
        <Waypoints size={18} />
      ) : (
        <img src={asset(`/brand/integrations/${assets[id]}.svg`)} alt="" width="20" height="20" />
      )}
    </span>
  );
}
