import Link from 'next/link';
import { Plus } from 'lucide-react';
import { faqs } from '@/data/landing';

export function Faq() {
  return (
    <section className="px-section px-wrap px-faq" id="faq">
      <div className="px-heading px-heading-left reveal">
        <span className="px-eyebrow">FAQ</span>
        <h2>Questions, answered.</h2>
        <p>
          Still curious? The <Link href="/docs/">documentation</Link> covers setup, integrations and
          how the AI works.
        </p>
      </div>
      <div className="px-faq-list">
        {faqs.map((f) => (
          <details key={f.q} className="px-glow reveal">
            <summary>
              {f.q}
              <Plus size={18} aria-hidden="true" />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
