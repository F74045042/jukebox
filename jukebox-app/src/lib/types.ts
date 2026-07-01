export type SongStatus = 'waiting' | 'playing' | 'played';

export interface Song {
  id: string;
  venue_id: string;
  table_label: string;
  video_id: string;
  title: string;
  thumbnail: string;
  status: SongStatus;
  position: number;
  created_at: string;
  played_at: string | null;
  hidden?: boolean;
  replay_position?: number | null;
}

export interface VenueConfig {
  cooldownMin: number;
  maxPerTable: number;
  playHistoryWhenIdle: boolean;
  dailySearchLimit: number;
  searchCount: number;
  musicOnly: boolean;
  blockWords: string;
  maxSongMin: number;
  openHour: number;
  closeHour: number;
  skipVotesNeeded: number;
  paidBumpEnabled: boolean;
  bumpPrice: number;
  playerMode: 'music' | 'mv' | 'ktv';
  theme: 'retro' | 'dining' | 'minimal' | 'party';
}

export const DEFAULT_CONFIG: VenueConfig = {
  cooldownMin: 0,
  maxPerTable: 3,
  playHistoryWhenIdle: false,
  dailySearchLimit: 95,
  searchCount: 8,
  musicOnly: true,
  blockWords: '',
  maxSongMin: 0,
  openHour: 0,
  closeHour: 0,
  skipVotesNeeded: 0,
  paidBumpEnabled: false,
  bumpPrice: 0,
  playerMode: 'music',
  theme: 'retro',
};

export interface SearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
}
