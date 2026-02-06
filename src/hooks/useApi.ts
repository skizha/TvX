import { useState, useCallback } from 'react';
import { getApi, XtreamApiError } from '../api';
import type { ContentType } from '../types';
import { useAppStore, useSettingsStore } from '../store';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for loading categories for a content type
 */
export function useLoadCategories() {
  const [state, setState] = useState<UseApiState<void>>({
    data: null,
    loading: false,
    error: null,
  });

  const { setCategories } = useAppStore();

  const loadCategories = useCallback(async (type: ContentType) => {
    const api = getApi();
    if (!api) {
      setState({ data: null, loading: false, error: 'Not connected' });
      return;
    }

    setState({ data: null, loading: true, error: null });

    try {
      let apiCategories;
      switch (type) {
        case 'live':
          apiCategories = await api.getLiveCategories();
          break;
        case 'movie':
          apiCategories = await api.getVodCategories();
          break;
        case 'series':
          apiCategories = await api.getSeriesCategories();
          break;
      }

      const categories = api.transformCategories(apiCategories, type);
      setCategories(type, categories);
      setState({ data: null, loading: false, error: null });
    } catch (err) {
      const message = err instanceof XtreamApiError ? err.message : 'Failed to load categories';
      setState({ data: null, loading: false, error: message });
    }
  }, [setCategories]);

  return { ...state, loadCategories };
}

/**
 * Hook for loading content (channels, movies, or series)
 */
export function useLoadContent() {
  const [state, setState] = useState<UseApiState<void>>({
    data: null,
    loading: false,
    error: null,
  });

  const { setChannels, setMovies, setSeries, currentServer } = useAppStore();
  const { favorites } = useSettingsStore();

  const loadContent = useCallback(async (type: ContentType, categoryId?: number) => {
    const api = getApi();
    if (!api || !currentServer) {
      setState({ data: null, loading: false, error: 'Not connected' });
      return;
    }

    setState({ data: null, loading: true, error: null });

    try {
      const serverFavorites = favorites[currentServer.id] || { live: [], movie: [], series: [] };

      switch (type) {
        case 'live': {
          const streams = await api.getLiveStreams(categoryId);
          const channels = api.transformChannels(streams, serverFavorites.live);
          setChannels(channels);
          break;
        }
        case 'movie': {
          const vods = await api.getVodStreams(categoryId);
          const movies = api.transformMovies(vods, serverFavorites.movie);
          setMovies(movies);
          break;
        }
        case 'series': {
          const seriesList = await api.getSeries(categoryId);
          const series = api.transformSeriesList(seriesList, serverFavorites.series);
          setSeries(series);
          break;
        }
      }

      setState({ data: null, loading: false, error: null });
    } catch (err) {
      const message = err instanceof XtreamApiError ? err.message : 'Failed to load content';
      setState({ data: null, loading: false, error: message });
    }
  }, [setChannels, setMovies, setSeries, currentServer, favorites]);

  return { ...state, loadContent };
}

/**
 * Hook for loading all initial data after login
 */
export function useLoadInitialData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setCategories, setChannels, setMovies, setSeries, currentServer } = useAppStore();
  const { favorites } = useSettingsStore();

  const loadAll = useCallback(async () => {
    const api = getApi();
    if (!api || !currentServer) {
      setError('Not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const serverFavorites = favorites[currentServer.id] || { live: [], movie: [], series: [] };

      // Load all categories in parallel
      const [liveCategories, vodCategories, seriesCategories] = await Promise.all([
        api.getLiveCategories(),
        api.getVodCategories(),
        api.getSeriesCategories(),
      ]);

      setCategories('live', api.transformCategories(liveCategories, 'live'));
      setCategories('movie', api.transformCategories(vodCategories, 'movie'));
      setCategories('series', api.transformCategories(seriesCategories, 'series'));

      // Load initial content (first category or all)
      const [liveStreams, vodStreams, seriesList] = await Promise.all([
        api.getLiveStreams(),
        api.getVodStreams(),
        api.getSeries(),
      ]);

      setChannels(api.transformChannels(liveStreams, serverFavorites.live));
      setMovies(api.transformMovies(vodStreams, serverFavorites.movie));
      setSeries(api.transformSeriesList(seriesList, serverFavorites.series));

      setLoading(false);
    } catch (err) {
      const message = err instanceof XtreamApiError ? err.message : 'Failed to load data';
      setError(message);
      setLoading(false);
    }
  }, [setCategories, setChannels, setMovies, setSeries, currentServer, favorites]);

  return { loading, error, loadAll };
}

const CATEGORY_STEPS: { type: ContentType; label: string }[] = [
  { type: 'live', label: 'Live TV' },
  { type: 'movie', label: 'Movies' },
  { type: 'series', label: 'Series' },
];

/**
 * Hook for initial load of all 3 category types (with progress).
 * Uses cache when available; fetches from API otherwise.
 */
export function useLoadInitialCategories() {
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const { currentServer, setCategories } = useAppStore();
  const { getCachedCategories, setCachedCategories } = useSettingsStore();

  const serverId = currentServer?.id ?? '';

  const runInitialLoad = useCallback(async () => {
    const api = getApi();
    if (!api || !serverId) return;

    setLoading(true);
    setProgressPercent(0);
    setProgressMessage('Preparing…');

    try {
      for (let i = 0; i < CATEGORY_STEPS.length; i++) {
        const { type, label } = CATEGORY_STEPS[i];
        const step = i + 1;
        const percent = Math.round((step / CATEGORY_STEPS.length) * 100);
        setProgressMessage(`Loading ${label} categories…`);
        setProgressPercent(percent);

        const cached = getCachedCategories(serverId, type);
        if (cached && cached.length > 0) {
          setCategories(type, cached);
          continue;
        }

        let apiCategories;
        switch (type) {
          case 'live':
            apiCategories = await api.getLiveCategories();
            break;
          case 'movie':
            apiCategories = await api.getVodCategories();
            break;
          case 'series':
            apiCategories = await api.getSeriesCategories();
            break;
        }
        const categories = api.transformCategories(apiCategories, type);
        setCategories(type, categories);
        if (categories.length > 0) {
          setCachedCategories(serverId, type, categories);
        }
      }
      setProgressMessage('');
      setProgressPercent(100);
    } catch (err) {
      setProgressMessage('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [serverId, setCategories, getCachedCategories, setCachedCategories]);

  return { loading, progressMessage, progressPercent, runInitialLoad };
}
