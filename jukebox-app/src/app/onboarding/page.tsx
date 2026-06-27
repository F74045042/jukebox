import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyVenue } from '@/lib/server/data';
import OnboardingForm from './OnboardingForm';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const venue = await getMyVenue();
  if (venue) redirect('/dashboard');
  return <OnboardingForm />;
}
