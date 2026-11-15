import type { Metadata, Viewport } from 'next';
import './globals.css';
import './experience.css';
import './refinements.css';
import './story.css';
import './depth.css';
import './site.css';
import './docs.css';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { CursorFx } from '@/components/cursor-fx';
import { asset } from '@/data/base-path';
const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3100'),
  title: 'Pramaan — Every incident ends with proof it is fixed.',
  description:
    'Pramaan is the observability and incident platform with an AI production engineer: root cause with cited evidence, a fix tested in a sandbox, human approval, and proof in production that it worked.',
  icons: { icon: asset('/icon.svg') },
  openGraph: {
    title: 'Pramaan — Every incident ends with proof it is fixed.',
    description:
      'AI that finds the root cause, drafts the fix, waits for your approval and proves it worked.',
    type: 'website',
  },
};
export const viewport: Viewport = {
  themeColor: '#07070a',
  width: 'device-width',
  initialScale: 1,
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('pramaan-site-theme')==='light'?'light':'dark'}catch(e){}",
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <CursorFx />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
