import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Next, JetBrains_Mono, Schibsted_Grotesk } from 'next/font/google';
import { THEME_INIT_SCRIPT } from '@/features/theme/theme';
import { Providers } from './providers';
import './globals.css';

const body = Atkinson_Hyperlegible_Next({ subsets: ['latin'], variable: '--font-body' });
const heading = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-heading' });
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code' });

export const metadata: Metadata = {
  title: { default: 'AI Production Engineer', template: '%s · AI Production Engineer' },
  description: 'Find the cause, prove it with a test, ship the fix. A person always approves.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${body.variable} ${heading.variable} ${code.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
