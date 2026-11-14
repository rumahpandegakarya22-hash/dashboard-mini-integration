'use client';

import { useState } from 'react';
import { digits } from '@/lib/dashboard/format';

/**
 * Tombol Chat di tabel leads: membuka WhatsApp dan mencatat waktu chat pertama
 * (sekali saja) untuk KPI "Respons Leads Pertama". Pencatatan gagal tidak boleh
 * menghalangi staf membuka chat, jadi tautan WhatsApp tetap jalan apa adanya.
 */
export function LeadChatBtn({ num, dbId, sudah }: { num: unknown; dbId: string; sudah: string }) {
  const [dicatat, setDicatat] = useState(sudah);

  function catat() {
    if (dicatat || !dbId) return;
    fetch('/api/dashboard/leads/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(dbId) }),
      keepalive: true
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.chatPertamaPada) setDicatat(String(j.chatPertamaPada));
      })
      .catch(() => {});
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <a
        className="cell-btn cell-btn--wa"
        href={`https://wa.me/${digits(num)}`}
        target="_blank"
        rel="noopener"
        onClick={catat}
      >
        Chat
      </a>
      {dicatat && <small style={{ opacity: 0.7, fontSize: 11 }}>Chat pertama {dicatat.slice(0, 16)}</small>}
    </span>
  );
}
