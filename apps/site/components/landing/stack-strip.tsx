import Link from 'next/link';
import integrations from '@/data/integrations.json';
import { IntegrationIcon } from '../integration-icon';

export function StackStrip() {
  return (
    <section className="px-wrap px-stack reveal" aria-labelledby="stack-title">
      <h2 id="stack-title">Works with the stack you already run</h2>
      <div className="px-stack-row reveal" data-stagger>
        {integrations.map((i) => (
          <Link key={i.id} href={`/docs/${i.id}/`} className="px-stack-item">
            <IntegrationIcon id={i.id} />
            <span>{i.id === 'javascript' ? 'JavaScript' : i.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
