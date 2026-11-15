import { MousePointer2 } from 'lucide-react';

export function ReplayMini() {
  return (
    <div className="px-mini px-replay" aria-hidden="true">
      <div className="px-replay-screen">
        <span className="px-replay-line px-w-60" />
        <span className="px-replay-line px-w-40" />
        <span className="px-replay-block" />
        <span className="px-replay-cta">Pay now</span>
        <span className="px-replay-click" />
        <MousePointer2 className="px-replay-cursor" size={16} />
      </div>
      <div className="px-replay-bar">
        <i />
        <span>Rage click · 3 errors · 2:41</span>
      </div>
    </div>
  );
}
