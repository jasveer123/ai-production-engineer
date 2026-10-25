import type { ReactNode } from 'react';
import { RevealedTokenProvider } from '@/features/integrations/token-context';

export default function IntegrationsLayout({ children }: { children: ReactNode }) {
  return <RevealedTokenProvider>{children}</RevealedTokenProvider>;
}
