'use client';

import { ArrowRight } from 'lucide-react';

export type FlowArrows = 'both' | 'right' | 'none';

export default function FlowButton({
  children,
  className = '',
  arrows = 'right',
  ...rest
}: { arrows?: FlowArrows } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`flow-btn ${className}`}>
      {arrows === 'both' && <ArrowRight aria-hidden className="flow-btn__arrow flow-btn__arrow--in" />}
      <span className="flow-btn__label">{children}</span>
      <span aria-hidden className="flow-btn__ripple" />
      {arrows !== 'none' && <ArrowRight aria-hidden className="flow-btn__arrow flow-btn__arrow--out" />}
    </button>
  );
}
