import { cn } from '@/lib/cn';
import { formatLogTime } from '@/lib/format';
import type { LogLevel, LogLine } from '../types';

const LEVEL_TEXT: Record<LogLevel, string> = {
  debug: 'text-ink-muted',
  info: 'text-info',
  warn: 'text-warn',
  error: 'text-danger',
};

type LogViewerProps = { lines: LogLine[]; label: string; freshIds?: ReadonlySet<string> };

export function LogViewer({ lines, label, freshIds }: LogViewerProps) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface-sunken">
      <ol aria-label={label} className="max-h-[480px] overflow-auto py-1">
        {lines.map((line) => (
          <li
            key={line.id}
            className={cn(
              'grid grid-cols-[96px_52px_128px_minmax(0,1fr)] gap-3 border-l-[3px] px-3 py-[3px] font-mono text-xs leading-5 max-sm:grid-cols-[80px_48px_minmax(0,1fr)]',
              line.level === 'error'
                ? 'border-danger bg-danger-soft'
                : line.evidence
                  ? 'border-spark hover:bg-surface-hover'
                  : 'border-transparent hover:bg-surface-hover',
              freshIds?.has(line.id) && 'animate-flash',
            )}
          >
            <time dateTime={line.at} className="tabular-nums text-ink-muted">
              {formatLogTime(line.at)}
            </time>
            <span className={cn('font-semibold uppercase', LEVEL_TEXT[line.level])}>
              {line.level}
            </span>
            <span className="truncate text-ink-muted max-sm:hidden">{line.service}</span>
            <span className="whitespace-pre-wrap break-words text-ink">
              {line.message}
              {line.evidence && (
                <span className="ml-2 rounded bg-spark-soft px-1 font-sans text-[11px] font-semibold text-spark-ink">
                  AI evidence
                </span>
              )}
              {line.traceId && (
                <a
                  href={`/logs/?q=trace:${line.traceId.slice(0, 8)}`}
                  className="ml-2 text-brand underline underline-offset-2"
                >
                  trace {line.traceId.slice(0, 8)}
                </a>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
