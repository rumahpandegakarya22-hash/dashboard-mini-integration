'use client';

import { useMemo, useState } from 'react';
import Pagination from './Pagination';
import { fmtDateID, fmtHP, initials } from '@/lib/dashboard/format';

/* PORT dari `table()` + `wireTable()` public/app.js (Fase 4).

   Perilaku yang dipertahankan: sort per kolom (localeCompare 'id' numeric),
   pencarian tabel, filter per kolom lewat tombol corong, paginasi, dan
   empty-state yang menyebut periode aktif.

   Perbedaan implementasi: versi lama menyaring/mengurutkan dengan memindahkan
   node <tr> dan menyetel display:none; di sini semuanya turunan state React dan
   hanya baris halaman aktif yang dirender. Nama kelas & struktur markup
   dipertahankan agar CSS hasil port berlaku apa adanya. */

export interface TableCol {
  key: string;
  label?: string;
}

export type TableRow = Record<string, any>;

/** Kolom yang tidak diberi tombol filter (verbatim NO_FILTER_COLS app.js). */
const NO_FILTER_COLS = new Set(['check', 'aksi', 'open', 'tagihan']);

/** Kolom yang dirender sebagai tanggal (verbatim DATE_KEYS app.js). */
const DATE_KEYS = new Set(['tanggal', 'masuk', 'tempo', 'deadline', 'kategori']);

const LOG_STATUS_CLASS: Record<string, string> = {
  Complete: 's-complete',
  'In Progress': 's-progress',
  Pending: 's-pending',
  Incomplete: 's-pending',
  Approved: 's-approved'
};

const FunnelIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M1.6 3h12.8L9.2 9.1v3.4l-2.4 1.2V9.1z" fill="currentColor" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4-4" />
  </svg>
);

const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 11h18" />
  </svg>
);

/** Teks sel untuk sort/filter/pencarian — meniru `cellText()`, yang sengaja
 *  mengabaikan inisial avatar pada kolom Nama. */
function cellText(row: TableRow, key: string): string {
  if (key === 'name') return String(row.nama || row.name || row[key] || '');
  const v = row[key];
  if (v && typeof v === 'object' && 't' in v) return String(v.t ?? '');
  if (DATE_KEYS.has(key)) return fmtDateID(v);
  return String(v ?? '');
}

function Cell({ col, row }: { col: TableCol; row: TableRow }) {
  const k = col.key;
  const v = row[k];

  if (DATE_KEYS.has(k)) {
    return (
      <td>
        <span className="cell-date">
          <CalIcon />
          {fmtDateID(v)}
        </span>
      </td>
    );
  }

  switch (k) {
    case 'check':
      return (
        <td>
          <span className={`cbox ${row.sel ? 'on' : ''}`} />
        </td>
      );
    case 'name': {
      const nm = row.nama || row.name || v;
      return (
        <td>
          <span className="cell-name">
            <span className="avatar">{initials(nm)}</span>
            {nm}
          </span>
        </td>
      );
    }
    case 'status':
    case 'jenisTx':
    case 'prioritas':
      return v && typeof v === 'object' && v.t ? (
        <td>
          <span className={`status ${v.c ?? ''}`}>{v.t}</span>
        </td>
      ) : (
        <td>{v ?? ''}</td>
      );
    case 'logStatus': {
      const txt = v && typeof v === 'object' && v.t ? v.t : v;
      return (
        <td>
          <span className={`status ${LOG_STATUS_CLASS[txt] || 's-pending'}`}>{txt ?? ''}</span>
        </td>
      );
    }
    case 'kontak':
    case 'wa':
    case 'hp':
      return <td>{fmtHP(v)}</td>;
    case 'darurat1':
    case 'darurat2':
      return <td>{v ? fmtHP(v) : '—'}</td>;
    case 'id':
      return <td className="cell-id">{v ?? ''}</td>;
    default:
      return <td>{v ?? ''}</td>;
  }
}

export interface TableProps {
  cols: TableCol[];
  data: TableRow[];
  title?: React.ReactNode;
  titleRight?: boolean;
  /** Nama periode aktif — hanya untuk teks empty-state, seperti versi lama. */
  periodLabel?: string;
  /** Query pencarian global dari topbar (digabung AND dgn pencarian tabel). */
  globalQuery?: string;
  /** Slot toolbar di atas tabel (search, tombol tambah, dll). */
  toolbar?: React.ReactNode;
  /** Render sel khusus yang butuh konteks (tombol WA/Open/Tagihan, dropdown). */
  renderCell?: (col: TableCol, row: TableRow) => React.ReactNode | undefined;
}

export default function Table({
  cols,
  data,
  title,
  titleRight,
  periodLabel,
  globalQuery = '',
  toolbar,
  renderCell
}: TableProps) {
  const [sort, setSort] = useState<{ i: number; dir: 'asc' | 'desc' } | null>(null);
  const [query, setQuery] = useState('');
  const [colFilter, setColFilter] = useState<Record<number, Set<string>>>({});
  const [openFilter, setOpenFilter] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const rowText = (r: TableRow) => cols.map((c) => cellText(r, c.key)).join(' ').toLowerCase();

  const filtered = useMemo(() => {
    const tq = query.toLowerCase();
    const gq = globalQuery.toLowerCase();
    return data.filter((r) => {
      const txt = rowText(r);
      if (tq && !txt.includes(tq)) return false;
      if (gq && !txt.includes(gq)) return false;
      for (const [idx, set] of Object.entries(colFilter)) {
        if (!set.size) continue;
        if (!set.has(cellText(r, cols[Number(idx)].key).toLowerCase())) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, globalQuery, colFilter, cols]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const key = cols[sort.i].key;
    return [...filtered].sort((a, b) => {
      const ta = cellText(a, key);
      const tb = cellText(b, key);
      return sort.dir === 'asc'
        ? ta.localeCompare(tb, 'id', { numeric: true })
        : tb.localeCompare(ta, 'id', { numeric: true });
    });
  }, [filtered, sort, cols]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * pageSize, curPage * pageSize);

  const toggleSort = (i: number) =>
    setSort((s) => (s && s.i === i ? { i, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { i, dir: 'asc' }));

  const distinct = (i: number) =>
    [...new Set(data.map((r) => cellText(r, cols[i].key)))].filter((x) => x !== '').sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));

  return (
    <section className="table-block">
      {title && <h2 className={`section-title ${titleRight ? 'right' : ''}`}>{title}</h2>}

      {/* Markup toolbar mengikuti `toolbar()` app.js persis — .table-toolbar,
          .tool-btn, dan <label class="search"> — supaya CSS hasil port berlaku. */}
      <div className="table-toolbar">
        {toolbar}
        <label className="search">
          <span>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Cari semua kolom…"
            data-act="tsearch"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <div className="card" style={{ padding: '4px 2px' }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th key={i} data-col={i} className="th-sort" data-dir={sort?.i === i ? sort.dir : undefined}>
                    <span onClick={() => toggleSort(i)} style={{ cursor: 'pointer' }}>
                      {c.label || ''}
                      <span className="sort-ind" aria-hidden="true">
                        {sort?.i === i ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </span>
                    </span>
                    {!NO_FILTER_COLS.has(c.key) && (
                      <button
                        type="button"
                        className="col-filter-btn"
                        data-fcol={i}
                        aria-label={`Filter ${c.label || 'kolom'}`}
                        title="Filter kolom"
                        onClick={() => setOpenFilter((o) => (o === i ? null : i))}
                      >
                        <FunnelIcon />
                      </button>
                    )}
                    {openFilter === i && (
                      <div className="colfilter-menu">
                        {distinct(i).map((val) => {
                          const set = colFilter[i] || new Set<string>();
                          const on = set.has(val.toLowerCase());
                          return (
                            <label key={val}>
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => {
                                  const next = new Set(set);
                                  if (on) next.delete(val.toLowerCase());
                                  else next.add(val.toLowerCase());
                                  setColFilter((f) => ({ ...f, [i]: next }));
                                  setPage(1);
                                }}
                              />
                              {val}
                            </label>
                          );
                        })}
                        <button
                          type="button"
                          className="cfm-apply"
                          onClick={() => {
                            setColFilter((f) => ({ ...f, [i]: new Set() }));
                            setOpenFilter(null);
                            setPage(1);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((r, ri) => (
                  <tr key={ri} className={r.sel ? 'is-selected' : ''}>
                    {cols.map((c, ci) => {
                      const custom = renderCell?.(c, r);
                      return custom !== undefined ? (
                        <td key={ci}>{custom}</td>
                      ) : (
                        <Cell key={ci} col={c} row={r} />
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr className="tbl-empty">
                  <td colSpan={cols.length}>
                    Tidak ada data pada periode <b>{periodLabel || 'ini'}</b>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        total={sorted.length}
        page={curPage}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </section>
  );
}
