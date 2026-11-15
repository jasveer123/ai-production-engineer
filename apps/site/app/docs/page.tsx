import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Download } from 'lucide-react';
import { Catalogue } from '@/components/catalogue';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { asset } from '@/data/base-path';
export const metadata: Metadata = {
  title: 'Documentation — Pramaan',
  description:
    'Product guides and source-synced integration documentation for the Pramaan SRE platform.',
};
export default function Docs() {
  return (
    <main id="main">
      <section className="container page-hero docs-hero">
        <HeroBackdrop />
        <span className="eyebrow">Pramaan documentation</span>
        <h1>
          A good first signal
          <br />
          starts with a clear setup.
        </h1>
        <p>
          Follow your first event into Pramaan, connect your stack, and understand how the product
          fits together.
        </p>
        <Link className="btn" href="/docs/getting-started/">
          Start here <ArrowRight size={15} />
        </Link>
      </section>
      <section className="container catalogue-section">
        <div className="docs-source-note">
          <BookOpen size={18} />
          <div>
            <strong>Your product’s integration docs, brought here.</strong>
            <p>
              Installation steps, snippets and troubleshooting are synced from the application
              catalogue. Examples use placeholders, never live workspace tokens.
            </p>
          </div>
        </div>
        <Catalogue docs />
        <div className="reference-downloads">
          <h2>Source references</h2>
          <p>
            Download the original project guides. These are reference snapshots; for installation,
            use the current integration page above.
          </p>
          <div>
            {[
              ['node-sdk.md', 'Node SDK README'],
              ['python-sdk.md', 'Python SDK README'],
              ['collector.md', 'Collector README'],
              ['integration-architecture.md', 'Integration architecture'],
            ].map(([file, label]) => (
              <a href={asset(`/reference/${file}`)} download key={file}>
                <Download size={14} />
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
