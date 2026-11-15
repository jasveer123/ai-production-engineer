import type { Metadata } from 'next';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
export const metadata: Metadata = { title: 'Marketing site privacy — Pramaan' };
export default function Privacy() {
  return (
    <main id="main" className="container legal-page">
      <HeroBackdrop />
      <span className="eyebrow">Marketing site notice</span>
      <h1>
        Your workspace stays
        <br />
        your workspace.
      </h1>
      <h2>This website</h2>
      <p>
        This marketing and documentation site has no lead-capture database, advertising trackers or
        analytics scripts. Search and copy controls run in your browser. The hosting provider may
        retain ordinary access logs. Your day/night preference is stored locally in your browser so
        it persists between pages.
      </p>
      <h2>Real product previews</h2>
      <p>
        Product frames load the separately running Pramaan application. They use your own existing
        product session; they do not publish the owner’s session to visitors. The product server
        receives those page requests. A visitor without access may see the sign-in page. The
        marketing site cannot read a cross-origin workspace frame.
      </p>
      <h2>Your product data</h2>
      <p>
        Account, telemetry and workspace data belong to the separate product’s data-handling
        configuration. This notice is limited to the marketing website and is not a substitute for
        the product’s privacy policy.
      </p>
      <h2>Documentation examples</h2>
      <p>
        Published configuration snippets contain placeholders. Do not submit production secrets to a
        public search field or documentation page.
      </p>
    </main>
  );
}
