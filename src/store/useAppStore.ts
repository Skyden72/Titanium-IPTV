import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Channel, EpgIndex, LoadStatus, PlaylistSource } from '../types/media';

type Profile = {
  username?: string;
};

type Settings = {
  autoplay: boolean;
  showStats: boolean;
};

type AppState = {
  profile: Profile;
  settings: Settings;
  playlistSource: PlaylistSource | null;
  playlistStatus: LoadStatus;
  epgStatus: LoadStatus;
  channels: Channel[];
  epg: EpgIndex;
  selectedChannelKey: string | null;
  setProfile: (profile: Partial<Profile>) => void;
  setSettings: (settings: Partial<Settings>) => void;
  setPlaylistSource: (source: PlaylistSource | null) => void;
  setPlaylistStatus: (status: LoadStatus) => void;
  setEpgStatus: (status: LoadStatus) => void;
  setChannels: (channels: Channel[]) => void;
  setEpg: (epg: EpgIndex) => void;
  selectChannel: (key: string | null) => void;
};

export const getChannelKey = (channel: Channel): string =>
  (channel.id && channel.id.trim().toLowerCase()) || channel.url.trim().toLowerCase();

const storage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage.getItem(name);
    } catch (error) {
      console.warn('Unable to read from localStorage', error);
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(name, value);
    } catch (error) {
      console.warn('Unable to write to localStorage', error);
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.removeItem(name);
    } catch (error) {
      console.warn('Unable to remove localStorage item', error);
    }
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: {},
      settings: {
        autoplay: false,
        showStats: true,
      },
      playlistSource: null,
      playlistStatus: 'idle',
      epgStatus: 'idle',
      channels: [],
      epg: {},
      selectedChannelKey: null,
      setProfile: (profile) => {
        const current = get().profile;
        const next = { ...current, ...profile };
        const isSame = Object.keys(next).every((key) => {
          const typedKey = key as keyof Profile;
          return next[typedKey] === current[typedKey];
        });
        if (isSame) {
          return;
        }
        set({ profile: next });
      },
      setSettings: (settings) => {
        const current = get().settings;
        const next = { ...current, ...settings };
        if (
          next.autoplay === current.autoplay &&
          next.showStats === current.showStats
        ) {
          return;
        }
        set({ settings: next });
      },
      setPlaylistSource: (source) => {
        const current = get().playlistSource;
        if (
          current?.url === source?.url &&
          current?.title === source?.title &&
          current?.lastUpdated === source?.lastUpdated
        ) {
          return;
        }
        set({ playlistSource: source ?? null });
      },
      setPlaylistStatus: (status) => {
        if (get().playlistStatus === status) {
          return;
        }
        set({ playlistStatus: status });
      },
      setEpgStatus: (status) => {
        if (get().epgStatus === status) {
          return;
        }
        set({ epgStatus: status });
      },
      setChannels: (channels) => {
        const normalized = channels.map((channel) => ({
          ...channel,
          url: channel.url.trim(),
          id: channel.id?.trim() || undefined,
          name: channel.name?.trim() || channel.id || channel.url,
          logo: channel.logo?.trim() || undefined,
          group: channel.group?.trim() || undefined,
        }));
        const currentKey = get().selectedChannelKey;
        let nextKey: string | null = currentKey;
        if (normalized.length === 0) {
          nextKey = null;
        } else if (!nextKey || !normalized.some((channel) => getChannelKey(channel) === nextKey)) {
          nextKey = getChannelKey(normalized[0]);
        }
        set({ channels: normalized, selectedChannelKey: nextKey });
      },
      setEpg: (epg) => {
        const normalized: EpgIndex = {};
        for (const [key, programs] of Object.entries(epg)) {
          const normalizedKey = key.trim().toLowerCase();
          normalized[normalizedKey] = programs
            .map((program) => ({
              ...program,
              channel: normalizedKey,
            }))
            .sort((a, b) => a.start - b.start);
        }
        set({ epg: normalized });
      },
      selectChannel: (key) => {
        const current = get().selectedChannelKey;
        if (current === key) {
          return;
        }
        if (!key) {
          set({ selectedChannelKey: null });
          return;
        }
        const exists = get()
          .channels.some((channel) => getChannelKey(channel) === key);
        if (!exists) {
          return;
        }
        set({ selectedChannelKey: key });
      },
    }),
    {
      name: 'titanium-iptv-store',
      storage: createJSONStorage(() => storage),
      partialize: (state) =>
        ({
          profile: state.profile,
          settings: state.settings,
        } as unknown as AppState),
    },
  ),
);
