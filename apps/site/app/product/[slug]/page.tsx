import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, BookOpen } from 'lucide-react';
import { products, appUrl } from '@/data/products';
import { productStories } from '@/data/product-stories';
import { AgentTheater } from '@/components/agent-theater';
import { BeamsBackground } from '@/components/ui/beams-background';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
export const dynamicParams = false;
export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = products.find((p) => p.slug === slug);
  return {
    title: p ? `${p.name} — Pramaan` : 'Product — Pramaan',
    description: p?.description,
  };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = products.find((p) => p.slug === slug);
  if (!p) notFound();
  const story = productStories[slug];
  const actions = (
    <>
      <a className="px-btn px-btn-primary" href={`${appUrl}${p.route}`}>
        Open {p.name.toLowerCase()} <ArrowUpRight size={16} />
      </a>
      <Link className="px-btn px-btn-ghost" href={`/docs/${p.guide}/`}>
        Read the guide <BookOpen size={16} />
      </Link>
    </>
  );
  return (
    <main id="main" className="px-page">
      {slug === 'ai-investigation' ? (
        <section className="px-hero px-pd-ai">
          <div className="px-hero-bg" aria-hidden="true">
            <BeamsBackground />
            <div className="px-hero-grain" />
          </div>
          <div className="px-wrap px-hero-inner">
            <span className="px-pill">
              <i className="px-pill-dot" />
              <span>{p.name}</span>
            </span>
            <h1>{p.label}</h1>
            <p className="px-lede">{p.description}</p>
            <div className="px-actions">{actions}</div>
          </div>
          <div className="px-wrap px-hero-stage">
            <AgentTheater />
          </div>
        </section>
      ) : (
        <section className="container detail-hero">
          <HeroBackdrop />
          <Link className="back-link" href="/">
            Pramaan <span>/</span> Product <span>/</span> {p.name}
          </Link>
          <span className="eyebrow">{p.name}</span>
          <h1>{p.label}</h1>
          <p>{p.description}</p>
          <div className="hero-actions">{actions}</div>
        </section>
      )}
      <section className="px-wrap px-pd-story">
        <div className="px-pd-row">
          <span className="px-eyebrow">Why it matters</span>
          <div>
            <h2>{story.problemTitle}</h2>
            <p className="px-pd-lead">{story.problem}</p>
          </div>
        </div>
        <div className="px-pd-row">
          <span className="px-eyebrow">What it does</span>
          <dl className="px-pd-caps">
            {story.capabilities.map((c) => (
              <div key={c.title}>
                <dt>{c.title}</dt>
                <dd>{c.body}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="px-pd-row">
          <span className="px-eyebrow">In an incident</span>
          <div>
            <p className="px-pd-lead">{story.incident}</p>
            <p className="px-pd-path">
              {p.workflow.map((w, i) => (
                <span key={w}>
                  {w}
                  {i < p.workflow.length - 1 && <ArrowRight size={14} />}
                </span>
              ))}
            </p>
            <p className="px-pd-fine">{p.note}</p>
          </div>
        </div>
        <div className="px-pd-row">
          <span className="px-eyebrow">Keep exploring</span>
          <ul className="px-pd-more">
            {products
              .filter((other) => other.slug !== slug)
              .map((other) => (
                <li key={other.slug}>
                  <Link href={`/product/${other.slug}/`}>
                    <b>{other.name}</b>
                    <span>{other.label}</span>
                    <ArrowUpRight size={16} />
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
