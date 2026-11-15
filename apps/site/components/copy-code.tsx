'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
export function CopyCode({ code, filename }: { code: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="code-block">
      <div>
        <span>{filename || 'Example configuration'}</span>
        <button
          aria-label="Copy code"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setError(false);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
      {error && <p role="status">Clipboard unavailable. Select and copy the code above.</p>}
    </div>
  );
}
