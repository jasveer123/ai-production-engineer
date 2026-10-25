import { Banner } from '@/components/ui/banner';

/** What a setup did and what is left, in words. */
export function ResultList({
  done,
  todo,
  failed = [],
}: {
  done: string[];
  todo: string[];
  failed?: string[];
}) {
  return (
    <div className="grid gap-3">
      {done.length > 0 && (
        <Banner tone="ok" title="Done.">
          <ul className="m-0 mt-1 list-disc pl-5">
            {done.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Banner>
      )}
      {failed.length > 0 && (
        <Banner tone="danger" title="Some steps failed.">
          <ul className="m-0 mt-1 list-disc pl-5">
            {failed.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Banner>
      )}
      {todo.length > 0 && (
        <Banner tone="info" title="Left for you:">
          <ul className="m-0 mt-1 list-disc pl-5">
            {todo.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Banner>
      )}
    </div>
  );
}
