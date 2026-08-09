/* Stop gradien batang — PORT VERBATIM dari konstanta `barStops*` public/app.js.
   Dijadikan komponen supaya bisa dioper sbg prop `gradStops` ke <Bars>. */

export const BarStopsGreen = () => (
  <>
    <stop offset="0%" stopColor="#8ce0a0" />
    <stop offset="100%" stopColor="#2f8f7a" />
  </>
);

export const BarStopsWarm = () => (
  <>
    <stop offset="0%" stopColor="#e58a6f" />
    <stop offset="100%" stopColor="#7a5fae" />
  </>
);

/** Bar Owner: palet brand (dusty rose → charcoal), bukan biru. */
export const BarStopsOwner = () => (
  <>
    <stop offset="0%" stopColor="#CF7B72" />
    <stop offset="100%" stopColor="#3A3635" />
  </>
);
