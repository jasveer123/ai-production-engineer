import { TabNav } from '@/components/ui/tab-nav';

const TABS = [
  { href: '/integrations/', label: 'Send data', count: 'Ways 1–5' },
  { href: '/integrations/tools/', label: 'Connect tools', count: 'Ways 6–7' },
  { href: '/integrations/code/', label: 'Code', count: 'GitHub' },
];

export function IntegrationTabs({ current }: { current: string }) {
  return <TabNav label="Integration groups" items={TABS} current={current} />;
}
