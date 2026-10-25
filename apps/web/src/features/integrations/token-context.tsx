'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { TOKEN_PLACEHOLDER } from './ways';

/**
 * A token is only readable right after it is created or rotated. Keep it in memory for this tab
 * so the setup snippets can show it; it is gone on reload, which is the point.
 */
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
