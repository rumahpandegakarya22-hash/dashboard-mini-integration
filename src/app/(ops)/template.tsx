import PageTransition from '@/components/ui/PageTransition';

export default function OpsTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
