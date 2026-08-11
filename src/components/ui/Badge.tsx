export interface BadgeProps {
  children: React.ReactNode;
  tone?: string;
}

export default function Badge({ children, tone }: BadgeProps) {
  return <span className={`status ${tone ?? ''}`.trim()}>{children}</span>;
}
