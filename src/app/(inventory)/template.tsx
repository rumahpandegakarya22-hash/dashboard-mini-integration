import PageTransition from '@/components/ui/PageTransition';

export default function InventoryTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
