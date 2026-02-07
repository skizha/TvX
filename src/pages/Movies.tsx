import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import { useLoadCategories } from '../hooks';
import { ContentGrid } from '../components/ContentGrid';
import { getApi } from '../api';
import type { Movie, Category } from '../types';

// Extended category type to include custom groups
interface ExtendedCategory extends Category {
  isCustomGroup?: boolean;
  customGroupId?: string;
}

type SortOption = 'name' | 'year' | 'rating';

export function MoviesPage() {
  const { categories, currentServer } = useAppStore();
  const { groupVisibility, getCachedCategories, getCachedContent, getAllCachedContent, setCachedCategories, setCachedContent, clearCacheForType, favorites, customGroups } = useSettingsStore();
  const { loading: loadingCategories, loadCategories } = useLoadCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const serverId = currentServer?.id || '';
  const serverVisibilityRaw = groupVisibility[serverId] || {};
  const isVisible = (id: number | string) => serverVisibilityRaw[`movie_${String(id)}`] !== false;
  const serverGroups = customGroups[serverId] || [];

  // Load categories (with cache)
  useEffect(() => {
    if (!serverId) return;

    // Check cache first
    const cached = getCachedCategories(serverId, 'movie');
    if (cached && cached.length > 0) {
      useAppStore.getState().setCategories('movie', cached);
      setLoadingProgress('');
      return;
    }

    // Load from API if not cached
    if (categories.movie.length === 0) {
      setLoadingProgress('Loading Movie categories…');
      loadCategories('movie').then(() => {
        // Cache the categories
        const cats = useAppStore.getState().categories.movie;
        if (cats.length > 0) {
          setCachedCategories(serverId, 'movie', cats);
        }
        setLoadingProgress('');
      });
    }
  }, [serverId, categories.movie.length, loadCategories, getCachedCategories, setCachedCategories]);

  // Load content for selected category (with cache) or custom group
  const loadCategoryContent = useCallback(async (categoryId: number | string) => {
    if (!serverId) return;

    // Check if this is a custom group – load from cache first, then filter by group IDs; API only if no cache
    if (typeof categoryId === 'string') {
      const customGroup = serverGroups.find((g) => g.id === categoryId);
      if (customGroup) {
        const allCached = getAllCachedContent(serverId, 'movie');
        if (allCached && allCached.length > 0) {
          const customMovies = allCached.filter((m) =>
            customGroup.contentIds.some((id) => Number(id) === m.id)
          ) as Movie[];
          setMovies(customMovies);
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
          const vods = await api.getVodStreams();
          const allMoviesFromApi = api.transformMovies(vods, serverFavorites.movie);
          const customMovies = allMoviesFromApi.filter((m) =>
            customGroup.contentIds.some((id) => Number(id) === m.id)
          );
          setMovies(customMovies);
          useAppStore.getState().setMovies(allMoviesFromApi);
        } catch (err) {
          console.error('Failed to load custom group movies:', err);
          setMovies([]);
        } finally {
          setLoadingContent(false);
          setLoadingProgress('');
        }
        return;
      }
    }

    // Check cache first for API categories
    const cached = getCachedContent(serverId, 'movie', categoryId as number);
    if (cached && cached.length > 0) {
      const cachedMovies = cached as Movie[];
      setMovies(cachedMovies);

      // Also update the app store so Detail page can access movies
      const currentMovies = useAppStore.getState().movies;
      const newMovies = [...currentMovies];
      cachedMovies.forEach((movie) => {
        if (!newMovies.find((m) => m.id === movie.id)) {
          newMovies.push(movie);
        }
      });
      useAppStore.getState().setMovies(newMovies);
      return;
    }

    // Load from API
    const api = getApi();
    if (!api) return;

    setLoadingContent(true);
    setLoadingProgress('Loading movies…');

    try {
      const serverFavorites = favorites[serverId] || { live: [], movie: [], series: [] };
      const vods = await api.getVodStreams(categoryId as number);
      const transformedMovies = api.transformMovies(vods, serverFavorites.movie);
      setMovies(transformedMovies);

      // Also update the app store so Detail page can access movies
      const currentMovies = useAppStore.getState().movies;
      const newMovies = [...currentMovies];
      transformedMovies.forEach((movie) => {
        if (!newMovies.find((m) => m.id === movie.id)) {
          newMovies.push(movie);
        }
      });
      useAppStore.getState().setMovies(newMovies);

      // Cache the content
      setCachedContent(serverId, 'movie', categoryId as number, transformedMovies);
    } catch (err) {
      console.error('Failed to load movies:', err);
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
      setMovies([]);
    }
  }, [selectedCategoryId, loadCategoryContent]);

  // Filter and sort movies
  const visibleMovies = useMemo(() => {
    let filtered = movies;

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => m.name.toLowerCase().includes(query));
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'year') return (b.year || '').localeCompare(a.year || '');
      if (sortBy === 'rating') return parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
      return 0;
    });

    return filtered;
  }, [movies, sortBy, searchQuery]);

  // Combine API categories with custom groups and filter by visibility
  const visibleCategories = useMemo(() => {
    // API categories
    const apiCategories: ExtendedCategory[] = categories.movie
      .filter((cat) => isVisible(cat.id))
      .map((cat) => ({ ...cat, isCustomGroup: false }));

    // Custom groups for this content type
    const customGroupCategories: ExtendedCategory[] = serverGroups
      .filter((g) => g.type === 'movie' && isVisible(g.id))
      .map((g) => ({
        id: -1, // Placeholder, we use customGroupId instead
        name: g.name,
        parentId: null,
        type: 'movie' as const,
        isCustomGroup: true,
        customGroupId: g.id,
      }));

    return [...customGroupCategories, ...apiCategories];
  }, [categories.movie, serverVisibilityRaw, serverGroups]);

  // Refresh handler: clears cache and re-fetches from server
  const handleRefresh = useCallback(async () => {
    if (!serverId || isRefreshing) return;
    setIsRefreshing(true);
    setSelectedCategoryId(null);
    setMovies([]);
    clearCacheForType(serverId, 'movie');
    useAppStore.getState().setCategories('movie', []);
    useAppStore.getState().setMovies([]);
    setLoadingProgress('Refreshing Movie categories…');
    try {
      await loadCategories('movie');
      const cats = useAppStore.getState().categories.movie;
      if (cats.length > 0) {
        setCachedCategories(serverId, 'movie', cats);
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
            <h1 className="text-3xl font-bold text-white">Movies</h1>
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
              : 'Select a category to browse movies'}
          </p>
        </div>

        {/* Loading */}
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
    : categories.movie.find((c) => c.id === selectedCategoryId);
  const selectedCategoryName = selectedCategory?.name || 'Movies';

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
        <p className="text-gray-400">{visibleMovies.length} movies</p>
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
            placeholder="Search movies..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#16161f] border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-4 py-2.5 bg-[#16161f] border border-gray-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="name">Sort: A-Z</option>
          <option value="year">Sort: Year</option>
          <option value="rating">Sort: Rating</option>
        </select>
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
      {!loading && <ContentGrid type="movie" items={visibleMovies} loading={false} />}
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
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${isCustomGroup ? 'from-purple-500/20 to-pink-500/20 group-hover:from-purple-500/30 group-hover:to-pink-500/30' : 'from-blue-500/20 to-purple-500/20 group-hover:from-blue-500/30 group-hover:to-purple-500/30'} flex items-center justify-center flex-shrink-0 transition-colors`}>
        {isCustomGroup ? (
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        )}
      </div>
      <h3 className="font-semibold text-white truncate">{category.name}</h3>
    </button>
  );
}
