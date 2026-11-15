import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bug,
  Globe,
  MonitorPlay,
  ScrollText,
  Users,
} from 'lucide-react';
import { platformProducts } from '@/data/landing';
import { UptimeMini } from './minis/uptime-mini';
import { TimelineMini } from './minis/timeline-mini';
import { OnCallMini } from './minis/oncall-mini';
import { StatusMini } from './minis/status-mini';
import { TelemetryMini } from './minis/telemetry-mini';
import { ErrorsMini } from './minis/errors-mini';
import { ReplayMini } from './minis/replay-mini';

const tiles = {
  uptime: { Icon: Activity, Mini: UptimeMini },
  incidents: { Icon: AlertTriangle, Mini: TimelineMini },
  oncall: { Icon: Users, Mini: OnCallMini },
  telemetry: { Icon: ScrollText, Mini: TelemetryMini },
  errors: { Icon: Bug, Mini: ErrorsMini },
  rum: { Icon: MonitorPlay, Mini: ReplayMini },
  status: { Icon: Globe, Mini: StatusMini },
};

export function Platform() {
  return (
    <section className="px-section px-wrap" id="platform">
      <div className="px-heading reveal">
        <h2>
          Everything the AI needs to see.
          <br />
          <span className="px-dim">Everything your team needs to respond.</span>
        </h2>
        <p>
          Monitoring, incidents, telemetry and user experience in one place, so the AI investigates
          with the whole picture.
        </p>
      </div>
      <div className="px-bento">
        {platformProducts.map((p) => {
          const { Icon, Mini } = tiles[p.id];
          return (
            <Link key={p.id} href={p.href} className={`px-bt px-bt-${p.id} px-glow reveal`}>
              <div className="px-bt-visual" aria-hidden="true">
                <div className="px-bt-stage">
                  <Mini />
                </div>
              </div>
              <div className="px-bt-copy">
                <span className="px-bt-kicker">
                  <Icon size={15} />
                  {p.name}
                </span>
                <h3>{p.tagline}</h3>
                <p>{p.features[0]}.</p>
                <div className="px-bt-foot">
                  <span>
                    <b>{p.kpis[0][1]}</b> {p.kpis[0][0].toLowerCase()}
                  </span>
                  <ArrowUpRight size={16} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
