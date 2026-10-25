'use client';

import { Banner } from '@/components/ui/banner';
import { errorMessage } from '@/lib/api';
import { useTools } from '../queries';
import { ToolCard } from './tool-card';

export function ToolsGrid() {
  const tools = useTools();
  if (tools.isPending) return <p className="text-ink-muted">Loading tools…</p>;
  if (tools.isError)
    return (
      <Banner tone="danger" title="Could not load tools.">
        {errorMessage(tools.error)}
      </Banner>
    );
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {tools.data.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
