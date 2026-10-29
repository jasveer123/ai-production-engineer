'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { TOKEN_PLACEHOLDER } from './ways';

const TokenContext = createContext<{
  token: string | null;
  setToken: (t: string | null) => void;
} | null>(null);

export function RevealedTokenProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  return <TokenContext.Provider value={{ token, setToken }}>{children}</TokenContext.Provider>;
}

export function useRevealedToken() {
  const ctx = useContext(TokenContext);
  if (!ctx) throw new Error('useRevealedToken needs RevealedTokenProvider');
  return { ...ctx, snippetToken: ctx.token ?? TOKEN_PLACEHOLDER };
}
