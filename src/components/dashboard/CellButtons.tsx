

import { digits, safeUrl } from '@/lib/dashboard/format';

const IconWa = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.1 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.3.5-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3.1.1.1.5-.1 1.1Z" />
  </svg>
);

const IconLink = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
  </svg>
);

export function WaBtn({ num, label }: { num: unknown; label?: string }) {
  return (
    <a
      className="cell-btn cell-btn--wa"
      href={`https://wa.me/${digits(num)}`}
      target="_blank"
      rel="noopener"
    >
      <IconWa />
      {label || 'WhatsApp'}
    </a>
  );
}

export function OpenBtn({ url }: { url: unknown }) {
  return (
    <a className="cell-btn cell-btn--open" href={safeUrl(url)} target="_blank" rel="noopener">
      <IconLink /> OPEN
    </a>
  );
}

export function TagihanBtn({ num }: { num: unknown }) {
  return (
    <a
      className="cell-btn cell-btn--wa"
      href={`https://wa.me/${digits(num)}?text=Halo,%20berikut%20tagihan%20kost%20Anda.`}
      target="_blank"
      rel="noopener"
    >
      <IconWa /> Kirim
    </a>
  );
}
