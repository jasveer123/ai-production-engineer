'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';
import { appUrl, products } from '@/data/products';
import { ThemeToggle } from './theme-toggle';
import { asset } from '@/data/base-path';

const nav = [
  { href: '/product/ai-investigation/', label: 'AI engineer' },
  { href: '/#platform', label: 'Platform' },
  { href: '/docs/', label: 'Docs' },
  { href: '/about/', label: 'About' },
];

export function Brand() {
  return (
    <Link href="/" className="px-brand" aria-label="Pramaan home">
      <img src={asset('/brand/logo.svg')} alt="" width="28" height="28" />
      <span>Pramaan</span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="px-header">
        <div className="px-nav">
          <Brand />
          <nav aria-label="Main navigation" className={open ? 'px-links is-open' : 'px-links'}>
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname === n.href ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {n.label}
              </Link>
            ))}
            <a className="px-links-mobile-only" href={`${appUrl}/login`}>
              Sign in
            </a>
          </nav>
          <div className="px-nav-end">
            <ThemeToggle />
            <a href={`${appUrl}/login`} className="px-signin">
              Sign in
            </a>
            <a className="px-btn px-btn-primary px-btn-sm" href={`${appUrl}/sign-up`}>
              Get access <ArrowRight size={14} />
            </a>
            <button
              type="button"
              className="px-menu"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="px-footer">
      <div className="px-footer-glow" aria-hidden="true" />
      <div className="px-wrap px-footer-grid">
        <div className="px-footer-brand">
          <Brand />
          <p>Every incident ends with proof it is fixed.</p>
          <small>Pramaan means “proof” in Hindi.</small>
        </div>
        <div>
          <h3>Product</h3>
          {products.map((p) => (
            <Link key={p.slug} href={`/product/${p.slug}/`}>
              {p.name}
            </Link>
          ))}
        </div>
        <div>
          <h3>Resources</h3>
          <Link href="/docs/">Documentation</Link>
          <Link href="/docs/getting-started/">Quick start</Link>
          <Link href="/integrations/">Integrations</Link>
          <Link href="/docs/tokens-and-endpoints/">Tokens and endpoints</Link>
        </div>
        <div>
          <h3>Company</h3>
          <Link href="/about/">About and vision</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/privacy/">Privacy</Link>
          <a href={`${appUrl}/login`}>Sign in</a>
        </div>
      </div>
      <div className="px-wrap px-footer-bottom">
        <span>© {new Date().getFullYear()} Pramaan. In early access.</span>
        <span>Examples on this site use illustrative data.</span>
      </div>
    </footer>
  );
}
