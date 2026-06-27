import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PlayerClient from './PlayerClient';

export const dynamic = 'force-dynamic';

export default async function PlayerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <PlayerClient venueId={process.env.NEXT_PUBLIC_DEFAULT_VENUE_ID!} email={user.email ?? ''} />;
}
