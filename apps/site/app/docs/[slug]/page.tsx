import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Check, Info } from 'lucide-react';
import integrations from '@/data/integrations.json';
import { guides } from '@/data/guides';
import { appUrl } from '@/data/products';
import { DocsToc } from '@/components/docs-toc';
import { DocsNav } from '@/components/docs-nav';
import { CopyCode } from '@/components/copy-code';
export const dynamicParams = false;
export function generateStaticParams() {
  return [...integrations.map((i) => ({ slug: i.id })), ...guides.map((g) => ({ slug: g.slug }))];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const i = integrations.find((i) => i.id === slug);
  const g = guides.find((g) => g.slug === slug);
  return {
    title: `${i?.name || g?.title || 'Guide'} — Pramaan docs`,
    description: i?.description || g?.intro,
  };
}
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const integration = integrations.find((i) => i.id === slug);
  const guide = guides.find((g) => g.slug === slug);
  if (!integration && !guide) notFound();
  return (
    <main id="main" className="container docs-layout">
      <DocsNav />
      <article className="doc-article">
        <div className="doc-breadcrumb">
          <Link href="/docs/">Documentation</Link>
          <span>/</span>
          <span>{integration ? 'Integrations' : guide?.category}</span>
        </div>
        <h1>{integration?.name || guide?.title}</h1>
        <p className="doc-lead">{integration?.description || guide?.intro}</p>
        {integration ? (
          <>
            <div className="doc-context">
              <Info size={17} />
              <p>
                Before you start, replace <code>YOUR_PRAMAAN_URL</code>,{' '}
                <code>YOUR_INGEST_URL</code> and <code>YOUR_TOKEN</code> with your workspace values.{' '}
                <Link href="/docs/tokens-and-endpoints/">Understand the placeholders →</Link>
              </p>
            </div>
            <div className="doc-facts">
              <div>
                <span>Access required</span>
                <p>{integration.facts.access}</p>
              </div>
              <div>
                <span>Default limits</span>
                <p>{integration.facts.limits}</p>
              </div>
            </div>
            <section>
              <h2>What it collects</h2>
              <ul className="check-list">
                {integration.collects.map((c) => (
                  <li key={c}>
                    <Check size={14} />
                    {c}
                  </li>
                ))}
              </ul>
            </section>
            <div className="method-jump">
              <span>Setup methods</span>
              {integration.methods.map((m) => (
                <a href={`#method-${m.id}`} key={m.id}>
                  {m.label}
                </a>
              ))}
            </div>
            {integration.methods.map((m) => (
              <section className="method-section" id={`method-${m.id}`} key={m.id}>
                <span className="eyebrow">Installation method</span>
                <h2>{m.label}</h2>
                <p>{m.summary}</p>
                <ol className="setup-steps">
                  {m.steps.map((s, index) => (
                    <li key={`${m.id}-${index}`}>
                      <span className="step-number">{index + 1}</span>
                      <div>
                        <h3>{s.title}</h3>
                        {'description' in s && s.description && <p>{s.description}</p>}
                        {'code' in s && s.code && (
                          <CopyCode code={s.code.content} filename={s.code.filename} />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="troubleshooting">
                  <h3>Troubleshooting</h3>
                  <ul>
                    {m.troubleshoot.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
            <section className="doc-related">
              <h2>Related integrations</h2>
              <div>
                {integration.related.map((id) => {
                  const related = integrations.find((i) => i.id === id);
                  return related ? (
                    <Link href={`/docs/${id}/`} key={id}>
                      {related.name}
                      <ArrowUpRight size={13} />
                    </Link>
                  ) : null;
                })}
              </div>
            </section>
          </>
        ) : (
          guide?.sections.map((s, i) => (
            <section className="guide-section" key={s.title} id={`section-${i}`}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </section>
          ))
        )}
        <div className="doc-bottom">
          <p>
            Product guides explain current implementation and configuration requirements. Verify
            your own deployment before relying on an operational workflow.
          </p>
          <a
            className="btn btn-secondary"
            href={`${appUrl}${integration ? `/integrations/${integration.id}` : '/integrations'}`}
          >
            Open in Pramaan <ArrowUpRight size={14} />
          </a>
          <Link href="/docs/">
            All documentation <ArrowRight size={13} />
          </Link>
        </div>
      </article>
      <DocsToc
        items={
          integration
            ? [
                { id: 'main', label: 'Overview' },
                ...integration.methods.map((m) => ({
                  id: `method-${m.id}`,
                  label: m.label,
                })),
              ]
            : guide?.sections.map((s, i) => ({
                id: `section-${i}`,
                label: s.title,
              })) || []
        }
      />
    </main>
  );
}
