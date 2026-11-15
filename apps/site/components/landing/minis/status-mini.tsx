import { Check } from 'lucide-react';

const services = ['Website', 'API', 'Checkout', 'Webhooks'];

export function StatusMini() {
  return (
    <div className="px-mini px-status" aria-hidden="true">
      <div className="px-status-banner">
        <Check size={14} /> All systems operational
      </div>
      {services.map((s) => (
        <div key={s} className="px-mini-row">
          <span>{s}</span>
          <i className="px-status-dot" />
        </div>
      ))}
    </div>
  );
}
