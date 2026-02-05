import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { ContentGrid } from '../components/ContentGrid';
import type { ContentType, Channel, Movie, Series } from '../types';

type TabType = 'all' | ContentType;

export function SearchPage() {
  const { channels, movies, series } = useAppStore();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const results = useMemo(() => {
    if (!query.trim()) {
      return { live: [], movie: [], series: [], all: [] };
    }

    const q = query.toLowerCase();

    const liveResults = channels.filter((c) => c.name.toLowerCase().includes(q));
    const movieResults = movies.filter((m) => m.name.toLowerCase().includes(q));
    const seriesResults = series.filter((s) => s.name.toLowerCase().includes(q));

    return {
      live: liveResults,
      movie: movieResults,
      series: seriesResults,
      all: [...liveResults, ...movieResults, ...seriesResults] as (Channel | Movie | Series)[],
    };
  }, [query, channels, movies, series]);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: results.all.length },
    { key: 'live', label: 'Live TV', count: results.live.length },
    { key: 'movie', label: 'Movies', count: results.movie.length },
    { key: 'series', label: 'Series', count: results.series.length },
  ];

  const displayedResults = activeTab === 'all' ? results.all : results[activeTab];
  const displayedType: ContentType = activeTab === 'all' ? 'live' : activeTab;

  return (
    <div className="p-6">
      {/* Search Input */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels, movies, series..."
            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {query && (
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-sm opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {query ? (
        displayedResults.length > 0 ? (
          <ContentGrid
            type={displayedType}
            items={displayedResults}
          />
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-gray-400">No results found for "{query}"</p>
          </div>
        )
      ) : (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-400">Start typing to search</p>
        </div>
      )}
    </div>
  );
}
