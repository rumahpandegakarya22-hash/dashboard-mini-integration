'use client';

import { useState } from 'react';
import { WaBtn } from '../CellButtons';
import { ROOM_BADGE, ROOM_FILTERS } from '@/lib/dashboard/views/pages';
import { digits } from '@/lib/dashboard/format';
import type { RoomRow } from '@/lib/dashboard/views/types';

/* PORT VERBATIM dari `rooms(variant)` public/app.js.

   Varian "ops" menampilkan tombol Hubungi (WhatsApp) di kaki kartu; varian
   default menampilkan harga per bulan. Filter chip status kamar di-port jadi
   state React — di sumber ia menyembunyikan kartu lewat atribut data-status. */

export default function Rooms({ rooms, variant }: { rooms: RoomRow[]; variant?: 'ops' }) {
  const [filter, setFilter] = useState('Semua');
  const isOps = variant === 'ops';
  const shown = filter === 'Semua' ? rooms : rooms.filter((r) => r.status === filter);

  return (
    <section className="view">
      <h2 className="section-title">DATA KAMAR</h2>

      <div className="room-filter">
        {ROOM_FILTERS.map((f) => (
          <button
            key={f}
            className={`chip ${f === filter ? 'is-active' : ''}`}
            data-roomfilter={f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rooms rooms-30">
        {shown.map((r) => (
          <article className="room" data-status={r.status} key={r.no}>
            <div className="room__top">
              <span className="room__no">{r.no}</span>
              <span className={`room__badge ${ROOM_BADGE[r.status] ?? ''}`}>{r.status}</span>
            </div>
            <div className="room__type">{r.jenis}</div>
            <div className="room__occupant">
              Penghuni
              <br />
              <b>{r.penghuni || '-'}</b>
            </div>
            {isOps ? (
              <div className="room__foot room__foot--wa">
                {digits(r.wa) ? <WaBtn num={r.wa} label="Hubungi" /> : <span className="muted">Tidak ada kontak</span>}
              </div>
            ) : (
              <div className="room__foot">
                <span className="price">{r.harga}</span>
                <span>/bln</span>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
