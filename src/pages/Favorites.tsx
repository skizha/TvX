import { useState, useMemo } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import { ContentGrid } from '../components/ContentGrid';
import type { ContentType } from '../types';

type TabType = 'all' | ContentType;

export function FavoritesPage() {
  const { channels, movies, series, currentServer } = useAppStore();
  const { favorites } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const serverId = currentServer?.id || '';
  const serverFavorites = favorites[serverId] || { live: [], movie: [], series: [] };

  const favoriteItems = useMemo(() => {
    const liveItems = channels.filter((c) => serverFavorites.live.includes(c.id));
    const movieItems = movies.filter((m) => serverFavorites.movie.includes(m.id));
    const seriesItems = series.filter((s) => serverFavorites.series.includes(s.id));

    return {
      live: liveItems,
      movie: movieItems,
      series: seriesItems,
      all: [...liveItems, ...movieItems, ...seriesItems],
    };
  }, [channels, movies, series, serverFavorites]);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: favoriteItems.all.length },
    { key: 'live', label: 'Live TV', count: favoriteItems.live.length },
    { key: 'movie', label: 'Movies', count: favoriteItems.movie.length },
    { key: 'series', label: 'Series', count: favoriteItems.series.length },
  ];

  const displayedItems = activeTab === 'all' ? favoriteItems.all : favoriteItems[activeTab];
  const displayedType: ContentType = activeTab === 'all' ? 'live' : activeTab;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Favorites</h1>

      {/* Tabs */}
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

      {/* Content */}
      {displayedItems.length > 0 ? (
        <ContentGrid
          type={displayedType}
          items={displayedItems}
        />
      ) : (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <p className="text-gray-400">No favorites yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Press F or click the heart icon on any item to add it to favorites
          </p>
        </div>
      )}
    </div>
  );
}
