import CustomerView from '@/components/CustomerView';

// 向後相容：單店預設 venue（QR 舊網址 /c?table=）。新版多租戶用 /v/[venueId]。
export default function CustomerDefaultPage() {
  return <CustomerView venueId={process.env.NEXT_PUBLIC_DEFAULT_VENUE_ID!} />;
}
