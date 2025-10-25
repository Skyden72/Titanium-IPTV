import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

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
  setProfile: (profile: Partial<Profile>) => void;
  setSettings: (settings: Partial<Settings>) => void;
};

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
