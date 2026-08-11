

import AdminOverview from './AdminOverview';
import MarketingOverview from './MarketingOverview';
import OpsOverview from './OpsOverview';
import OwnerOverview from './OwnerOverview';
import SalesOverview from './SalesOverview';
import type { DashboardPageData } from '@/lib/dashboard/views/load';

const MAP = {
  admin: AdminOverview,
  marketing: MarketingOverview,
  operasional: OpsOverview,
  owner: OwnerOverview,
  sales: SalesOverview
} as const;

export type OverviewKey = keyof typeof MAP;

export default function OverviewFor({
  which,
  loaded,
  period,
  from,
  to
}: {
  which: OverviewKey;
  loaded: DashboardPageData;
  period: string;
  from?: string;
  to?: string;
}) {
  const Cmp = MAP[which];
  if (!Cmp) return null;
  return (
    <Cmp
      data={loaded.data}
      finance={loaded.finance}
      txGrid={loaded.txGrid}
      range={loaded.range}
      period={period}
      from={from}
      to={to}
    />
  );
}
