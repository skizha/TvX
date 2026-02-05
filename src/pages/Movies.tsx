import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import { useLoadCategories } from '../hooks';
import { ContentGrid } from '../components/ContentGrid';
import { getApi } from '../api';
import type { Movie, Category } from '../types';

type SortOption = 'name' | 'year' | 'rating';

export function MoviesPage() {
  const { categories, currentServer } = useAppStore();
  const { groupVisibility, getCachedCategories, getCachedContent, setCachedCategories, setCachedContent, favorites } = useSettingsStore();
  const { loading: loadingCategories, loadCategories } = useLoadCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');

  const serverId = currentServer?.id || '';
  const serverVisibility = groupVisibility[serverId] || {};

  // Load categories (with cache)
  useEffect(() => {
    if (!serverId) return;

    // Check cache first
    const cached = getCachedCategories(serverId, 'movie');
    if (cached && cached.length > 0) {
      useAppStore.getState().setCategories('movie', cached);
      return;
    }

    // Load from API if not cached
    if (categories.movie.length === 0) {
      setLoadingProgress('Loading categories...');
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

  // Load content for selected category (with cache)
  const loadCategoryContent = useCallback(async (categoryId: number) => {
    if (!serverId) return;

    // Check cache first
    const cached = getCachedContent(serverId, 'movie', categoryId);
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
    setLoadingProgress(`Loading movies...`);

    try {
      const serverFavorites = favorites[serverId] || { live: [], movie: [], series: [] };
      const vods = await api.getVodStreams(categoryId);
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
      setCachedContent(serverId, 'movie', categoryId, transformedMovies);
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      setLoadingContent(false);
      setLoadingProgress('');
    }
  }, [serverId, getCachedContent, setCachedContent, favorites]);

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

  // Filter visible categories
  const visibleCategories = useMemo(() => {
    return categories.movie.filter((cat) => serverVisibility[cat.id] !== false);
  }, [categories.movie, serverVisibility]);

  const loading = loadingContent || loadingCategories;

  // Show category selection view
  if (selectedCategoryId === null) {
    return (
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Movies</h1>
          <p className="text-gray-400">Select a category to browse movies</p>
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
                key={category.id}
                category={category}
                onClick={() => setSelectedCategoryId(category.id)}
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

  // Show content view
  const selectedCategory = categories.movie.find((c) => c.id === selectedCategoryId);

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
        <h1 className="text-3xl font-bold text-white mb-2">{selectedCategory?.name || 'Movies'}</h1>
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
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">{loadingProgress || 'Loading...'}</p>
          </div>
        </div>
      )}

      {/* Content Grid */}
      {!loading && <ContentGrid type="movie" items={visibleMovies} loading={false} />}
    </div>
  );
}

// Category Card Component
function CategoryCard({ category, onClick }: { category: Category; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-gradient-to-br from-[#1a1a2e] to-[#16161f] rounded-xl p-4 text-left hover:from-blue-900/30 hover:to-purple-900/30 transition-all duration-300 border border-gray-800/50 hover:border-blue-500/50 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-colors">
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      </div>
      <h3 className="font-semibold text-white truncate">{category.name}</h3>
    </button>
  );
}
