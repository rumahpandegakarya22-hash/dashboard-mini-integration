'use client';

import Table, { type TableCol, type TableRow } from '@/components/ui/Table';
import { WaBtn, OpenBtn, TagihanBtn } from '../CellButtons';


export interface DataTablePageProps {
  title?: React.ReactNode;
  titleRight?: boolean;
  cols: TableCol[];
  data: TableRow[];
  period: string;
}

export default function DataTablePage({ title, titleRight, cols, data, period }: DataTablePageProps) {
  const renderCell = (col: TableCol, row: TableRow): React.ReactNode | undefined => {
    switch (col.key) {
      case 'aksi':
        return <WaBtn num={row.wa} label="Chat" />;
      case 'open':
        return <OpenBtn url={row.link} />;
      case 'tagihan':
        return <TagihanBtn num={row.wa} />;
      default:
        return undefined; // pakai renderer default Table
    }
  };

  return (
    <Table
      title={title}
      titleRight={titleRight}
      cols={cols}
      data={data}
      periodLabel={period}
      renderCell={renderCell}
    />
  );
}
