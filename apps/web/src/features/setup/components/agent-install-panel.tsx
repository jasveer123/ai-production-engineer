'use client';

import { ListSkeleton } from '@/components/ui/skeleton';
import { CodeSnippet } from '@/components/ui/code-snippet';
import { useRevealedToken } from '@/features/integrations/token-context';
import { useSetupCapabilities } from '../queries';

/** Way 4 in one command: Linux (systemd or Docker) and Kubernetes. */
export function AgentInstallPanel() {
  const caps = useSetupCapabilities();
  const { snippetToken } = useRevealedToken();
  if (!caps.data) return <ListSkeleton label="Loading" />;
  const { scriptUrl, kubernetesUrl } = caps.data.agent;
  return (
    <div className="grid gap-3">
      <p className="m-0 text-[13px] text-ink-muted">
        Installs Vector, writes its config with your token, and starts it. It reads /var/log, the
        systemd journal and Docker logs.
      </p>
      <CodeSnippet
        label="Linux server (systemd, or Docker when there is no systemd)"
        code={`curl -fsSL ${scriptUrl} | sudo APE_TOKEN=${snippetToken} APE_SERVICE=my-app sh`}
      />
      <CodeSnippet
        label="Kubernetes (DaemonSet on every node)"
        code={`kubectl create namespace ape-agent\nkubectl -n ape-agent create secret generic ape-agent --from-literal=APE_TOKEN=${snippetToken}\nkubectl apply -f "${kubernetesUrl}?service=my-cluster"`}
      />
      <p className="m-0 text-[13px] text-ink-muted">
        Optional: APE_LOG_PATHS=/srv/app/*.log to read other files, APE_MODE=docker to run it as a
        container.
      </p>
    </div>
  );
}
