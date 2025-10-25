export interface Channel {
  id?: string;
  name?: string;
  logo?: string;
  group?: string;
  url: string;
  duration?: number;
  userAgent?: string;
}

export interface Program {
  channel: string;
  title: string;
  description?: string;
  start: number;
  end: number;
}

export type EpgIndex = Record<string, Program[]>;

export interface PlaylistSource {
  title: string;
  url: string;
  lastUpdated?: number;
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
