import CustomerView from '@/components/CustomerView';

// 多租戶客人頁：venueId 由網址帶（QR 編進這個網址）。
export default async function VenueCustomerPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  return <CustomerView venueId={venueId} />;
}
