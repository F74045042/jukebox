import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyVenue } from '@/lib/server/data';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const venue = await getMyVenue();
  if (!venue) redirect('/onboarding');
  return <DashboardClient venue={venue} email={user.email ?? ''} />;
}
