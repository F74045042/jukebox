'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CONFIG, type Song, type VenueConfig } from '@/lib/types';

// 訂閱單一店家的佇列/歷史/設定，任何變動即時刷新（realtime）。
export function useVenue(venueId: string) {
  const [queue, setQueue] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [config, setConfig] = useState<VenueConfig>(DEFAULT_CONFIG);
  const [skipVotes, setSkipVotes] = useState(0);
  const supabaseRef = useRef(createClient());
  const playingIdRef = useRef<string | null>(null);

  const reloadVotes = useCallback(async (playingId: string | null) => {
    if (!playingId) {
      setSkipVotes(0);
      return;
    }
    const { count } = await supabaseRef.current
      .from('skip_votes')
      .select('*', { count: 'exact', head: true })
      .eq('song_id', playingId);
    setSkipVotes(count ?? 0);
  }, []);

  const reload = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from('songs')
      .select('*')
      .eq('venue_id', venueId)
      .in('status', ['waiting', 'playing'])
      .order('position', { ascending: true });
    const list = (data ?? []) as Song[];
    setQueue(list);
    const playing = list.find((s) => s.status === 'playing');
    playingIdRef.current = playing?.id ?? null;
    reloadVotes(playing?.id ?? null);
  }, [venueId, reloadVotes]);

  const reloadHistory = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from('songs')
      .select('*')
      .eq('venue_id', venueId)
      .eq('status', 'played')
      .order('played_at', { ascending: false })
      .limit(100);
    setHistory((data ?? []) as Song[]);
  }, [venueId]);

  const reloadConfig = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from('venue_settings')
      .select('config')
      .eq('venue_id', venueId)
      .single();
    if (data?.config) setConfig({ ...DEFAULT_CONFIG, ...(data.config as Partial<VenueConfig>) });
  }, [venueId]);

  useEffect(() => {
    reload();
    reloadHistory();
    reloadConfig();
    const supabase = supabaseRef.current;
    const ch = supabase
      .channel(`venue-${venueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs', filter: `venue_id=eq.${venueId}` }, () => {
        reload();
        reloadHistory();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_settings', filter: `venue_id=eq.${venueId}` }, () => {
        reloadConfig();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skip_votes', filter: `venue_id=eq.${venueId}` }, () => {
        reloadVotes(playingIdRef.current);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [venueId, reload, reloadHistory, reloadConfig, reloadVotes]);

  return { queue, history, config, skipVotes, reload, reloadHistory, reloadConfig };
}
