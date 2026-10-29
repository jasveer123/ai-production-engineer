import { CopyButton } from './copy-button';

type CodeSnippetProps = { label: string; code: string; wrap?: boolean };

export function CodeSnippet({ label, code, wrap }: CodeSnippetProps) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface-sunken">
      <div className="flex items-center justify-between gap-2 border-b border-line py-1.5 pl-3 pr-1.5">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        <CopyButton text={code} />
      </div>
      <pre
        className={`m-0 overflow-x-auto p-3 font-mono text-[13px] leading-5 text-ink ${wrap ? 'whitespace-pre-wrap break-words' : ''}`}
      >
        {code}
      </pre>
    </div>
  );
}

type TokenFieldProps = { label: string; masked: string; full?: string; help: string };

export function TokenField({ label, masked, full, help }: TokenFieldProps) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-line-strong bg-surface-raised py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{masked}</code>
        {full && <CopyButton text={full} variant="secondary" />}
      </div>
      <span className="text-[13px] leading-5 text-ink-muted">{help}</span>
    </div>
  );
}
