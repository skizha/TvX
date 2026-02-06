import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ServerConnection,
  Category,
  Channel,
  Movie,
  Series,
  ContentType,
  UserPreferences,
  GroupVisibility,
  WatchHistoryEntry,
  AuthResponse,
  CustomGroup,
} from '../types';

// App State Store
interface AppState {
  // Connection
  currentServer: ServerConnection | null;
  authInfo: AuthResponse | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Content
  categories: {
    live: Category[];
    movie: Category[];
    series: Category[];
  };
  channels: Channel[];
  movies: Movie[];
  series: Series[];

  // UI State
  activeTab: ContentType;
  searchQuery: string;
  selectedCategoryId: number | null;

  // Actions
  setCurrentServer: (server: ServerConnection | null) => void;
  setAuthInfo: (info: AuthResponse | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setCategories: (type: ContentType, categories: Category[]) => void;
  setChannels: (channels: Channel[]) => void;
  setMovies: (movies: Movie[]) => void;
  setSeries: (series: Series[]) => void;
  setActiveTab: (tab: ContentType) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (id: number | null) => void;
  toggleFavorite: (type: ContentType, id: number) => void;
  reset: () => void;
}

const initialAppState = {
  currentServer: null,
  authInfo: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  categories: {
    live: [],
    movie: [],
    series: [],
  },
  channels: [],
  movies: [],
  series: [],
  activeTab: 'live' as ContentType,
  searchQuery: '',
  selectedCategoryId: null,
};

export const useAppStore = create<AppState>()((set) => ({
  ...initialAppState,

  setCurrentServer: (server) => set({ currentServer: server }),
  setAuthInfo: (info) => set({ authInfo: info }),
  setConnected: (connected) => set({ isConnected: connected }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setConnectionError: (error) => set({ connectionError: error }),

  setCategories: (type, categories) =>
    set((state) => ({
      categories: { ...state.categories, [type]: categories },
    })),

  setChannels: (channels) => set({ channels }),
  setMovies: (movies) => set({ movies }),
  setSeries: (series) => set({ series }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),

  toggleFavorite: (type, id) =>
    set((state) => {
      if (type === 'live') {
        return {
          channels: state.channels.map((ch) =>
            ch.id === id ? { ...ch, isFavorite: !ch.isFavorite } : ch
          ),
        };
      } else if (type === 'movie') {
        return {
          movies: state.movies.map((m) =>
            m.id === id ? { ...m, isFavorite: !m.isFavorite } : m
          ),
        };
      } else {
        return {
          series: state.series.map((s) =>
            s.id === id ? { ...s, isFavorite: !s.isFavorite } : s
          ),
        };
      }
    }),

  reset: () => set(initialAppState),
}));

// Content cache per server
interface ContentCache {
  categories: {
    live: Category[];
    movie: Category[];
    series: Category[];
  };
  channels: Record<number, Channel[]>; // categoryId -> channels
  movies: Record<number, Movie[]>; // categoryId -> movies
  series: Record<number, Series[]>; // categoryId -> series
  lastUpdated: number;
}

// Persisted Settings Store
interface SettingsState {
  // Saved servers
  servers: ServerConnection[];

  // Preferences
  preferences: UserPreferences;

  // Group visibility per server
  groupVisibility: Record<string, GroupVisibility>;

  // Favorites per server (serverId -> contentType -> ids)
  favorites: Record<string, Record<ContentType, number[]>>;

  // Watch history per server
  watchHistory: Record<string, WatchHistoryEntry[]>;

  // Custom groups per server
  customGroups: Record<string, CustomGroup[]>;

  // Content cache per server
  contentCache: Record<string, ContentCache>;

  // Actions
  addServer: (server: ServerConnection) => void;
  updateServer: (server: ServerConnection) => void;
  removeServer: (id: string) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  setGroupVisibility: (serverId: string, type: ContentType, categoryId: string | number, visible: boolean) => void;
  setAllGroupsVisibility: (serverId: string, type: ContentType, visible: boolean, categoryIds: (string | number)[]) => void;
  addFavorite: (serverId: string, type: ContentType, id: number) => void;
  removeFavorite: (serverId: string, type: ContentType, id: number) => void;
  addToWatchHistory: (serverId: string, entry: WatchHistoryEntry) => void;
  clearWatchHistory: (serverId: string) => void;

  // Custom group actions
  createCustomGroup: (serverId: string, group: Omit<CustomGroup, 'id' | 'createdAt'>) => string;
  deleteCustomGroup: (serverId: string, groupId: string) => void;
  addContentToGroup: (serverId: string, groupId: string, contentId: number) => void;
  removeContentFromGroup: (serverId: string, groupId: string, contentId: number) => void;

  // Cache actions
  setCachedCategories: (serverId: string, type: ContentType, categories: Category[]) => void;
  setCachedContent: (serverId: string, type: ContentType, categoryId: number, content: Channel[] | Movie[] | Series[]) => void;
  getCachedCategories: (serverId: string, type: ContentType) => Category[] | null;
  getCachedContent: (serverId: string, type: ContentType, categoryId: number) => Channel[] | Movie[] | Series[] | null;
  getAllCachedContent: (serverId: string, type: ContentType) => Channel[] | Movie[] | Series[] | null;
  clearCache: (serverId: string) => void;
}

const emptyCache: ContentCache = {
  categories: { live: [], movie: [], series: [] },
  channels: {},
  movies: {},
  series: {},
  lastUpdated: 0,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      servers: [],
      preferences: {
        theme: 'dark',
        defaultView: 'grid',
        showOneGroupAtATime: false,
        showCopyConfirmation: true,
        hideCredentialsInUrl: false,
      },
      groupVisibility: {},
      favorites: {},
      watchHistory: {},
      customGroups: {},
      contentCache: {},

      addServer: (server) =>
        set((state) => ({ servers: [...state.servers, server] })),

      updateServer: (server) =>
        set((state) => ({
          servers: state.servers.map((s) => (s.id === server.id ? server : s)),
        })),

      removeServer: (id) =>
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== id),
        })),

      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      setGroupVisibility: (serverId, type, categoryId, visible) =>
        set((state) => {
          const key = `${type}_${String(categoryId)}`;
          return {
            groupVisibility: {
              ...state.groupVisibility,
              [serverId]: {
                ...state.groupVisibility[serverId],
                [key]: visible,
              },
            },
          };
        }),

      setAllGroupsVisibility: (serverId, type, visible, categoryIds) =>
        set((state) => {
          const prev = state.groupVisibility[serverId] || {};
          const updates: GroupVisibility = {};
          categoryIds.forEach((id) => {
            updates[`${type}_${String(id)}`] = visible;
          });
          return {
            groupVisibility: {
              ...state.groupVisibility,
              [serverId]: { ...prev, ...updates },
            },
          };
        }),

      addFavorite: (serverId, type, id) =>
        set((state) => {
          const serverFavs = state.favorites[serverId] || { live: [], movie: [], series: [] };
          const typeFavs = serverFavs[type] || [];
          if (typeFavs.includes(id)) return state;
          return {
            favorites: {
              ...state.favorites,
              [serverId]: {
                ...serverFavs,
                [type]: [...typeFavs, id],
              },
            },
          };
        }),

      removeFavorite: (serverId, type, id) =>
        set((state) => {
          const serverFavs = state.favorites[serverId];
          if (!serverFavs) return state;
          return {
            favorites: {
              ...state.favorites,
              [serverId]: {
                ...serverFavs,
                [type]: serverFavs[type].filter((fid) => fid !== id),
              },
            },
          };
        }),

      addToWatchHistory: (serverId, entry) =>
        set((state) => {
          const history = state.watchHistory[serverId] || [];
          // Remove existing entry for same content
          const filtered = history.filter(
            (h) => !(h.contentType === entry.contentType && h.contentId === entry.contentId)
          );
          // Add new entry at start, limit to 100 items
          return {
            watchHistory: {
              ...state.watchHistory,
              [serverId]: [entry, ...filtered].slice(0, 100),
            },
          };
        }),

      clearWatchHistory: (serverId) =>
        set((state) => ({
          watchHistory: {
            ...state.watchHistory,
            [serverId]: [],
          },
        })),

      // Custom group actions
      createCustomGroup: (serverId, groupData) => {
        const id = crypto.randomUUID();
        const newGroup: CustomGroup = {
          ...groupData,
          id,
          createdAt: Date.now(),
        };
        set((state) => ({
          customGroups: {
            ...state.customGroups,
            [serverId]: [...(state.customGroups[serverId] || []), newGroup],
          },
        }));
        return id;
      },

      deleteCustomGroup: (serverId, groupId) =>
        set((state) => ({
          customGroups: {
            ...state.customGroups,
            [serverId]: (state.customGroups[serverId] || []).filter((g) => g.id !== groupId),
          },
        })),

      addContentToGroup: (serverId, groupId, contentId) =>
        set((state) => {
          const id = Number(contentId);
          const groups = state.customGroups[serverId] || [];
          return {
            customGroups: {
              ...state.customGroups,
              [serverId]: groups.map((g) =>
                g.id === groupId && !g.contentIds.some((cid) => Number(cid) === id)
                  ? { ...g, contentIds: [...g.contentIds, id] }
                  : g
              ),
            },
          };
        }),

      removeContentFromGroup: (serverId, groupId, contentId) =>
        set((state) => {
          const id = Number(contentId);
          const groups = state.customGroups[serverId] || [];
          return {
            customGroups: {
              ...state.customGroups,
              [serverId]: groups.map((g) =>
                g.id === groupId
                  ? { ...g, contentIds: g.contentIds.filter((cid) => Number(cid) !== id) }
                  : g
              ),
            },
          };
        }),

      // Cache actions
      setCachedCategories: (serverId, type, categories) =>
        set((state) => {
          const cache = state.contentCache[serverId] || { ...emptyCache };
          return {
            contentCache: {
              ...state.contentCache,
              [serverId]: {
                ...cache,
                categories: { ...cache.categories, [type]: categories },
                lastUpdated: Date.now(),
              },
            },
          };
        }),

      setCachedContent: (serverId, type, categoryId, content) =>
        set((state) => {
          const cache = state.contentCache[serverId] || { ...emptyCache };
          const contentKey = type === 'live' ? 'channels' : type === 'movie' ? 'movies' : 'series';
          return {
            contentCache: {
              ...state.contentCache,
              [serverId]: {
                ...cache,
                [contentKey]: { ...cache[contentKey], [categoryId]: content },
                lastUpdated: Date.now(),
              },
            },
          };
        }),

      getCachedCategories: (serverId, type) => {
        const cache = get().contentCache[serverId];
        if (!cache) return null;
        const cats = cache.categories[type];
        return cats && cats.length > 0 ? cats : null;
      },

      getCachedContent: (serverId, type, categoryId) => {
        const cache = get().contentCache[serverId];
        if (!cache) return null;
        const contentKey = type === 'live' ? 'channels' : type === 'movie' ? 'movies' : 'series';
        const content = cache[contentKey][categoryId] || null;

        // Invalidate movie cache if it's missing the extension field (old cache format)
        if (type === 'movie' && content && Array.isArray(content) && content.length > 0) {
          const firstMovie = content[0] as Movie;
          if (!firstMovie.extension) {
            return null; // Force refetch
          }
        }

        return content;
      },

      getAllCachedContent: (serverId, type) => {
        const cache = get().contentCache[serverId];
        if (!cache) return null;
        const contentKey = type === 'live' ? 'channels' : type === 'movie' ? 'movies' : 'series';
        const byCategory = cache[contentKey];
        const all = (Object.values(byCategory) as (Channel[] | Movie[] | Series[])[]).flat();
        if (all.length === 0) return null;
        // Dedupe by id (same item can be in multiple category caches in theory)
        const seen = new Set<number>();
        const deduped = all.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        return deduped as Channel[] | Movie[] | Series[];
      },

      clearCache: (serverId) =>
        set((state) => ({
          contentCache: {
            ...state.contentCache,
            [serverId]: { ...emptyCache },
          },
        })),
    }),
    {
      name: 'tvx-settings',
    }
  )
);
