'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CONFIG, type Song, type VenueConfig } from '@/lib/types';

// 訂閱單一店家的佇列/歷史/設定，任何變動即時刷新（realtime）。
export function useVenue(venueId: string) {
  const [queue, setQueue] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [config, setConfig] = useState<VenueConfig>(DEFAULT_CONFIG);
  const supabaseRef = useRef(createClient());

  const reload = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from('songs')
      .select('*')
      .eq('venue_id', venueId)
      .in('status', ['waiting', 'playing'])
      .order('position', { ascending: true });
    setQueue((data ?? []) as Song[]);
  }, [venueId]);

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
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [venueId, reload, reloadHistory, reloadConfig]);

  return { queue, history, config, reload, reloadHistory, reloadConfig };
}
