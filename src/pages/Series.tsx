import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import { useLoadCategories } from '../hooks';
import { ContentGrid } from '../components/ContentGrid';
import { getApi } from '../api';
import type { Series, Category } from '../types';

// Extended category type to include custom groups
interface ExtendedCategory extends Category {
  isCustomGroup?: boolean;
  customGroupId?: string;
}

type SortOption = 'name' | 'year' | 'rating';

export function SeriesPage() {
  const { categories, currentServer } = useAppStore();
  const { groupVisibility, getCachedCategories, getCachedContent, getAllCachedContent, setCachedCategories, setCachedContent, favorites, customGroups } = useSettingsStore();
  const { loading: loadingCategories, loadCategories } = useLoadCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [series, setSeries] = useState<Series[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');

  const serverId = currentServer?.id || '';
  const serverVisibilityRaw = groupVisibility[serverId] || {};
  const isVisible = (id: number | string) => serverVisibilityRaw[`series_${String(id)}`] !== false;
  const serverGroups = customGroups[serverId] || [];

  // Load categories (with cache)
  useEffect(() => {
    if (!serverId) return;

    // Check cache first
    const cached = getCachedCategories(serverId, 'series');
    if (cached && cached.length > 0) {
      useAppStore.getState().setCategories('series', cached);
      return;
    }

    // Load from API if not cached
    if (categories.series.length === 0) {
      setLoadingProgress('Loading categories...');
      loadCategories('series').then(() => {
        // Cache the categories
        const cats = useAppStore.getState().categories.series;
        if (cats.length > 0) {
          setCachedCategories(serverId, 'series', cats);
        }
        setLoadingProgress('');
      });
    }
  }, [serverId, categories.series.length, loadCategories, getCachedCategories, setCachedCategories]);

  // Load content for selected category (with cache) or custom group
  const loadCategoryContent = useCallback(async (categoryId: number | string) => {
    if (!serverId) return;

    // Check if this is a custom group – load from cache first, then filter by group IDs; API only if no cache
    if (typeof categoryId === 'string') {
      const customGroup = serverGroups.find((g) => g.id === categoryId);
      if (customGroup) {
        const allCached = getAllCachedContent(serverId, 'series');
        if (allCached && allCached.length > 0) {
          const customSeriesList = allCached.filter((s) =>
            customGroup.contentIds.some((id) => Number(id) === s.id)
          ) as Series[];
          setSeries(customSeriesList);
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
          const seriesList = await api.getSeries();
          const allSeriesFromApi = api.transformSeriesList(seriesList, serverFavorites.series);
          const customSeriesList = allSeriesFromApi.filter((s) =>
            customGroup.contentIds.some((id) => Number(id) === s.id)
          );
          setSeries(customSeriesList);
          useAppStore.getState().setSeries(allSeriesFromApi);
        } catch (err) {
          console.error('Failed to load custom group series:', err);
          setSeries([]);
        } finally {
          setLoadingContent(false);
          setLoadingProgress('');
        }
        return;
      }
    }

    // Check cache first for API categories
    const cached = getCachedContent(serverId, 'series', categoryId as number);
    if (cached && cached.length > 0) {
      const cachedSeries = cached as Series[];
      setSeries(cachedSeries);

      // Also update the app store so Detail page can access series
      const currentSeries = useAppStore.getState().series;
      const newSeries = [...currentSeries];
      cachedSeries.forEach((s) => {
        if (!newSeries.find((existing) => existing.id === s.id)) {
          newSeries.push(s);
        }
      });
      useAppStore.getState().setSeries(newSeries);
      return;
    }

    // Load from API
    const api = getApi();
    if (!api) return;

    setLoadingContent(true);
    setLoadingProgress(`Loading series...`);

    try {
      const serverFavorites = favorites[serverId] || { live: [], movie: [], series: [] };
      const seriesList = await api.getSeries(categoryId as number);
      const transformedSeries = api.transformSeriesList(seriesList, serverFavorites.series);
      setSeries(transformedSeries);

      // Also update the app store so Detail page can access series
      const currentSeries = useAppStore.getState().series;
      const newSeries = [...currentSeries];
      transformedSeries.forEach((s) => {
        if (!newSeries.find((existing) => existing.id === s.id)) {
          newSeries.push(s);
        }
      });
      useAppStore.getState().setSeries(newSeries);

      // Cache the content
      setCachedContent(serverId, 'series', categoryId as number, transformedSeries);
    } catch (err) {
      console.error('Failed to load series:', err);
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
      setSeries([]);
    }
  }, [selectedCategoryId, loadCategoryContent]);

  // Filter and sort series
  const visibleSeries = useMemo(() => {
    let filtered = series;

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(query));
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'year') return (b.year || '').localeCompare(a.year || '');
      if (sortBy === 'rating') return parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
      return 0;
    });

    return filtered;
  }, [series, sortBy, searchQuery]);

  // Combine API categories with custom groups and filter by visibility
  const visibleCategories = useMemo(() => {
    // API categories
    const apiCategories: ExtendedCategory[] = categories.series
      .filter((cat) => isVisible(cat.id))
      .map((cat) => ({ ...cat, isCustomGroup: false }));

    // Custom groups for this content type
    const customGroupCategories: ExtendedCategory[] = serverGroups
      .filter((g) => g.type === 'series' && isVisible(g.id))
      .map((g) => ({
        id: -1, // Placeholder, we use customGroupId instead
        name: g.name,
        parentId: null,
        type: 'series' as const,
        isCustomGroup: true,
        customGroupId: g.id,
      }));

    return [...customGroupCategories, ...apiCategories];
  }, [categories.series, serverVisibilityRaw, serverGroups]);

  const loading = loadingContent || loadingCategories;

  // Show category selection view
  if (selectedCategoryId === null) {
    return (
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Series</h1>
          <p className="text-gray-400">Select a category to browse TV shows</p>
        </div>

        {/* Loading */}
        {loadingCategories && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">{loadingProgress || 'Loading...'}</p>
            </div>
          </div>
        )}

        {/* Category Grid */}
        {!loadingCategories && (
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

        {!loadingCategories && visibleCategories.length === 0 && (
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
    : categories.series.find((c) => c.id === selectedCategoryId);
  const selectedCategoryName = selectedCategory?.name || 'Series';

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
        <p className="text-gray-400">{visibleSeries.length} series</p>
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
            placeholder="Search series..."
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
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">{loadingProgress || 'Loading...'}</p>
          </div>
        </div>
      )}

      {/* Content Grid */}
      {!loading && <ContentGrid type="series" items={visibleSeries} loading={false} />}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        )}
      </div>
      <h3 className="font-semibold text-white truncate">{category.name}</h3>
    </button>
  );
}
