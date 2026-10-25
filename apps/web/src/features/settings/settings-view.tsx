'use client';

import { PageHeader } from '@/components/ui/page-header';
import { ApprovalPolicyCard } from './components/approval-policy-card';
import { SeverityRulesCard } from './components/severity-rules-card';
import { NotificationChannels } from './notification-channels';

export function SettingsView() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Where we tell you about incidents, how serious a new incident is, and who can approve a fix."
      />
      <NotificationChannels />
      <SeverityRulesCard />
      <ApprovalPolicyCard />
    </>
  );
}
