import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import { useLoadCategories } from '../hooks';
import { ContentGrid } from '../components/ContentGrid';
import { getApi } from '../api';
import type { Channel, Category } from '../types';

// Extended category type to include custom groups
interface ExtendedCategory extends Category {
  isCustomGroup?: boolean;
  customGroupId?: string;
}

export function LivePage() {
  const { categories, currentServer } = useAppStore();
  const { groupVisibility, getCachedCategories, getCachedContent, getAllCachedContent, setCachedCategories, setCachedContent, clearCacheForType, favorites, customGroups } = useSettingsStore();
  const { loading: loadingCategories, loadCategories } = useLoadCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const serverId = currentServer?.id || '';
  const serverVisibilityRaw = groupVisibility[serverId] || {};
  const isVisible = (id: number | string) => serverVisibilityRaw[`live_${String(id)}`] !== false;
  const serverGroups = customGroups[serverId] || [];

  // Load categories (with cache)
  useEffect(() => {
    if (!serverId) return;

    // Check cache first
    const cached = getCachedCategories(serverId, 'live');
    if (cached && cached.length > 0) {
      useAppStore.getState().setCategories('live', cached);
      setLoadingProgress('');
      return;
    }

    // Load from API if not cached – show progress immediately
    if (categories.live.length === 0) {
      setLoadingProgress('Loading Live TV categories…');
      loadCategories('live').then(() => {
        const cats = useAppStore.getState().categories.live;
        if (cats.length > 0) {
          setCachedCategories(serverId, 'live', cats);
        }
        setLoadingProgress('');
      });
    }
  }, [serverId, categories.live.length, loadCategories, getCachedCategories, setCachedCategories]);

  // Load content for selected category (with cache) or custom group
  const loadCategoryContent = useCallback(async (categoryId: number | string) => {
    if (!serverId) return;

    // Check if this is a custom group – load from cache first, then filter by group IDs; API only if no cache
    if (typeof categoryId === 'string') {
      const customGroup = serverGroups.find((g) => g.id === categoryId);
      if (customGroup) {
        const allCached = getAllCachedContent(serverId, 'live');
        if (allCached && allCached.length > 0) {
          const customChannels = allCached.filter((ch) =>
            customGroup.contentIds.some((id) => Number(id) === ch.id)
          ) as Channel[];
          setChannels(customChannels);
          const current = useAppStore.getState().channels;
          const byId = new Map(current.map((c) => [c.id, c]));
          allCached.forEach((ch) => byId.set(ch.id, ch as Channel));
          useAppStore.getState().setChannels(Array.from(byId.values()));
          setLoadingContent(false);
          return;
        }
        setLoadingContent(true);
        setLoadingProgress('Loading group...');
        const api = getApi();
        if (!api) {
          setLoadingContent(false);
          return;
        }
        try {
          const serverFavorites = favorites[serverId] || { live: [], movie: [], series: [] };
          const streams = await api.getLiveStreams();
          const allChannelsFromApi = api.transformChannels(streams, serverFavorites.live);
          const customChannels = allChannelsFromApi.filter((ch) =>
            customGroup.contentIds.some((id) => Number(id) === ch.id)
          );
          setChannels(customChannels);
          useAppStore.getState().setChannels(allChannelsFromApi);
        } catch (err) {
          console.error('Failed to load custom group channels:', err);
          setChannels([]);
        } finally {
          setLoadingContent(false);
          setLoadingProgress('');
        }
        return;
      }
    }

    const mergeChannelsIntoAppStore = (newChannels: Channel[]) => {
      const current = useAppStore.getState().channels;
      const byId = new Map(current.map((c) => [c.id, c]));
      newChannels.forEach((ch) => byId.set(ch.id, ch));
      useAppStore.getState().setChannels(Array.from(byId.values()));
    };

    // Check cache first for API categories
    const cached = getCachedContent(serverId, 'live', categoryId as number);
    if (cached && cached.length > 0) {
      const cachedChannels = cached as Channel[];
      setChannels(cachedChannels);
      mergeChannelsIntoAppStore(cachedChannels);
      return;
    }

    // Load from API
    const api = getApi();
    if (!api) return;

    setLoadingContent(true);
    setLoadingProgress('Loading channels…');

    try {
      const serverFavorites = favorites[serverId] || { live: [], movie: [], series: [] };
      const streams = await api.getLiveStreams(categoryId as number);
      const transformedChannels = api.transformChannels(streams, serverFavorites.live);
      setChannels(transformedChannels);
      mergeChannelsIntoAppStore(transformedChannels);

      // Cache the content
      setCachedContent(serverId, 'live', categoryId as number, transformedChannels);
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoadingContent(false);
      setLoadingProgress('');
    }
  }, [serverId, getCachedContent, getAllCachedContent, setCachedContent, favorites, serverGroups]);

  // Load content when category is selected
  useEffect(() => {
    if (selectedCategoryId !== null) {
      loadCategoryContent(selectedCategoryId);
    } else {
      setChannels([]);
    }
  }, [selectedCategoryId, loadCategoryContent]);

  // Filter channels by search
  const visibleChannels = useMemo(() => {
    let filtered = channels;

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((ch) => ch.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [channels, searchQuery]);

  // Combine API categories with custom groups and filter by visibility
  const visibleCategories = useMemo(() => {
    // API categories
    const apiCategories: ExtendedCategory[] = categories.live
      .filter((cat) => isVisible(cat.id))
      .map((cat) => ({ ...cat, isCustomGroup: false }));

    // Custom groups for this content type
    const customGroupCategories: ExtendedCategory[] = serverGroups
      .filter((g) => g.type === 'live' && isVisible(g.id))
      .map((g) => ({
        id: -1, // Placeholder, we use customGroupId instead
        name: g.name,
        parentId: null,
        type: 'live' as const,
        isCustomGroup: true,
        customGroupId: g.id,
      }));

    return [...customGroupCategories, ...apiCategories];
  }, [categories.live, serverVisibilityRaw, serverGroups]);

  // Refresh handler: clears cache and re-fetches from server
  const handleRefresh = useCallback(async () => {
    if (!serverId || isRefreshing) return;
    setIsRefreshing(true);
    setSelectedCategoryId(null);
    setChannels([]);
    clearCacheForType(serverId, 'live');
    useAppStore.getState().setCategories('live', []);
    useAppStore.getState().setChannels([]);
    setLoadingProgress('Refreshing Live TV categories…');
    try {
      await loadCategories('live');
      const cats = useAppStore.getState().categories.live;
      if (cats.length > 0) {
        setCachedCategories(serverId, 'live', cats);
      }
    } finally {
      setLoadingProgress('');
      setIsRefreshing(false);
    }
  }, [serverId, isRefreshing, clearCacheForType, loadCategories, setCachedCategories]);

  const loading = loadingContent || loadingCategories || loadingProgress !== '';

  // Show category selection view
  if (selectedCategoryId === null) {
    return (
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">Live TV</h1>
            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              title="Refresh from server"
            >
              <svg className={`w-4 h-4 ${isRefreshing || loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          <p className="text-gray-400">
            {!loading && visibleCategories.length > 0
              ? `${visibleCategories.length} categories`
              : 'Select a category to browse channels'}
          </p>
        </div>

        {/* Loading – show whenever we have progress text or hook is loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="w-14 h-14 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-5" />
            <p className="text-white font-medium text-lg mb-1">{loadingProgress || 'Loading…'}</p>
            <p className="text-gray-500 text-sm">This may take a moment</p>
          </div>
        )}

        {/* Category Grid */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visibleCategories.map((category) => (
              <CategoryCard
                key={category.isCustomGroup ? category.customGroupId : category.id}
                category={category}
                onClick={() => setSelectedCategoryId(category.isCustomGroup ? category.customGroupId! : category.id)}
                isCustomGroup={category.isCustomGroup}
              />
            ))}
          </div>
        )}

        {!loading && visibleCategories.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400">No categories available</p>
          </div>
        )}
      </div>
    );
  }

  // Show content view - find selected category (either API or custom)
  const selectedCategory = typeof selectedCategoryId === 'string'
    ? serverGroups.find((g) => g.id === selectedCategoryId)
    : categories.live.find((c) => c.id === selectedCategoryId);
  const selectedCategoryName = selectedCategory?.name || 'Live TV';

  return (
    <div className="p-6">
      {/* Header with back button */}
      <div className="mb-8">
        <button
          onClick={() => setSelectedCategoryId(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Categories</span>
        </button>
        <h1 className="text-3xl font-bold text-white mb-2">{selectedCategoryName}</h1>
        <p className="text-gray-400">{visibleChannels.length} channels</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#16161f] border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Loading Progress */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 px-4">
          <div className="w-14 h-14 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-5" />
          <p className="text-white font-medium text-lg mb-1">{loadingProgress || 'Loading…'}</p>
          <p className="text-gray-500 text-sm">This may take a moment</p>
        </div>
      )}

      {/* Content Grid */}
      {!loading && <ContentGrid type="live" items={visibleChannels} loading={false} />}
    </div>
  );
}

// Category Card Component
function CategoryCard({ category, onClick, isCustomGroup }: { category: ExtendedCategory; onClick: () => void; isCustomGroup?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-gradient-to-br from-[#1a1a2e] to-[#16161f] rounded-xl p-4 text-left hover:from-blue-900/30 hover:to-purple-900/30 transition-all duration-300 border border-gray-800/50 hover:border-blue-500/50 flex items-center gap-3"
    >
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${isCustomGroup ? 'from-purple-500/20 to-pink-500/20 group-hover:from-purple-500/30 group-hover:to-pink-500/30' : 'from-red-500/20 to-orange-500/20 group-hover:from-red-500/30 group-hover:to-orange-500/30'} flex items-center justify-center flex-shrink-0 transition-colors`}>
        {isCustomGroup ? (
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <h3 className="font-semibold text-white truncate">{category.name}</h3>
    </button>
  );
}
