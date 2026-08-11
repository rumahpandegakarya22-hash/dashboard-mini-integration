'use client';

import OriginSelect from './OriginSelect';

export const PAGE_SIZES = [10, 20, 30];

export interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}

export default function Pagination({ total, page, pageSize, onPage, onPageSize }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, totalPages);

  // jendela maks 5 nomor halaman di sekitar halaman aktif
  let a = Math.max(1, cur - 2);
  const b = Math.min(totalPages, a + 4);
  a = Math.max(1, b - 4);
  const nums: number[] = [];
  for (let p = a; p <= b; p++) nums.push(p);

  const navBtn = (key: string, label: string, disabled: boolean, to: number) => (
    <button type="button" key={key} data-pg={key} aria-label={key} disabled={disabled} onClick={() => onPage(to)}>
      {label}
    </button>
  );

  return (
    <nav className="pager" data-pager hidden={!total}>
      <OriginSelect
        ariaLabel="Baris per halaman"
        value={String(pageSize)}
        onChange={(v) => onPageSize(Number(v))}
        options={PAGE_SIZES.map((s) => ({ value: String(s), label: `${s} / hal` }))}
      />

      {navBtn('first', '«', cur === 1, 1)}
      {navBtn('prev', '‹', cur === 1, Math.max(1, cur - 1))}

      {nums.map((p) => (
        <button
          type="button"
          key={p}
          data-pg={p}
          className={p === cur ? 'is-active' : ''}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}

      {navBtn('next', '›', cur === totalPages, Math.min(totalPages, cur + 1))}
      {navBtn('last', '»', cur === totalPages, totalPages)}

      <span className="pager-info">{total} data</span>
    </nav>
  );
}
