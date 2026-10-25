'use client';

import { useIngestOverview } from '../queries';
import { SEND_WAYS } from '../ways';
import { WayTile } from './way-tile';

export function SendWaysGrid() {
  const { data } = useIngestOverview();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {SEND_WAYS.map((way) => {
        const s = data?.ways.find((w) => w.way === way.apiWay);
        return (
          <WayTile
            key={way.slug}
            way={way}
            status={s?.state ?? 'not_set_up'}
            lastReceivedAt={s?.lastReceivedAt ?? null}
          />
        );
      })}
    </div>
  );
}
