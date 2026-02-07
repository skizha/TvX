import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, useSettingsStore } from '../store';
import { getApi } from '../api';
import { copyToClipboard } from '../utils';
import { invoke } from '@tauri-apps/api/core';
import type { Movie, Series, Episode, ContentType } from '../types';

export function DetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { movies, series, currentServer } = useAppStore();
  const { favorites, addFavorite, removeFavorite, preferences } = useSettingsStore();

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const serverId = currentServer?.id || '';
  const { addToWatchHistory } = useSettingsStore();
  const contentType = type as ContentType;
  const itemId = parseInt(id || '0', 10);

  const item = contentType === 'movie'
    ? movies.find((m) => m.id === itemId)
    : series.find((s) => s.id === itemId);

  const isFavorite = favorites[serverId]?.[contentType]?.includes(itemId) || false;

  // Load series episodes
  useEffect(() => {
    if (contentType !== 'series' || !itemId) return;

    const loadEpisodes = async () => {
      const api = getApi();
      if (!api) return;

      setLoadingEpisodes(true);
      try {
        const info = await api.getSeriesInfo(itemId);
        const seasonEpisodes = info.episodes?.[selectedSeason.toString()] || [];
        setEpisodes(seasonEpisodes.map((ep) => ({
          id: parseInt(ep.id, 10),
          seasonNumber: ep.season,
          episodeNumber: ep.episode_num,
          title: ep.title,
          plot: ep.info?.plot || '',
          duration: ep.info?.duration || '',
          extension: ep.container_extension || 'mp4',
        })));
      } catch (err) {
        console.error('Failed to load episodes:', err);
      } finally {
        setLoadingEpisodes(false);
      }
    };

    loadEpisodes();
  }, [contentType, itemId, selectedSeason]);

  const handlePlay = async (episodeId?: number) => {
    const api = getApi();
    if (!api) return;
    let streamUrl: string;
    let title: string;
    if (contentType === 'movie') {
      const ext = movieItem.extension || 'mp4';
      streamUrl = api.buildVodStreamUrl(itemId, ext);
      title = item?.name ?? 'Movie';
    } else if (episodeId) {
      const ep = episodes.find((e) => e.id === episodeId);
      const ext = ep?.extension || 'mp4';
      streamUrl = api.buildSeriesStreamUrl(episodeId, ext);
      title = ep ? `${item?.name ?? 'Series'} – ${ep.title}` : item?.name ?? 'Episode';
    } else {
      return;
    }
    try {
      const contentIdForHistory = contentType === 'movie' ? itemId : episodeId!;
      await invoke('open_video_window', {
        title,
        streamUrl,
        startPositionSecs: undefined,
        serverId: serverId || undefined,
        contentType,
        contentId: contentIdForHistory,
      });
      if (serverId) {
        addToWatchHistory(serverId, {
          contentType,
          contentId: contentIdForHistory,
          timestamp: Date.now(),
          title,
          extension: contentType === 'movie' ? (item as Movie)?.extension : episodes.find((e) => e.id === episodeId)?.extension,
        });
      }
    } catch (err) {
      console.error('Failed to open video window:', err);
    }
  };

  const handleAdditionalPlayers = (episodeId?: number) => {
    if (contentType === 'movie') {
      navigate(`/player/movie/${itemId}`);
    } else if (episodeId) {
      navigate(`/player/series/${episodeId}`);
    }
  };

  const handleCopyUrl = async (episodeId?: number) => {
    const api = getApi();
    if (!api) return;

    let url: string;
    if (contentType === 'movie') {
      const ext = movieItem.extension || 'mp4';
      url = api.buildVodStreamUrl(itemId, ext);
    } else if (episodeId) {
      const ep = episodes.find((e) => e.id === episodeId);
      const ext = ep?.extension || 'mp4';
      url = api.buildSeriesStreamUrl(episodeId, ext);
    } else {
      return;
    }

    const success = await copyToClipboard(url);
    if (success) {
      setCopiedId(episodeId || itemId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleToggleFavorite = () => {
    if (isFavorite) {
      removeFavorite(serverId, contentType, itemId);
    } else {
      addFavorite(serverId, contentType, itemId);
    }
    useAppStore.getState().toggleFavorite(contentType, itemId);
  };

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Content not found</p>
      </div>
    );
  }

  const seriesItem = item as Series;
  const movieItem = item as Movie;

  return (
    <div className="min-h-full">
      {/* Backdrop */}
      <div className="relative h-64 md:h-96 bg-gray-800">
        {item.backdrop && (
          <img
            src={item.backdrop}
            alt={item.name}
            className="w-full h-full object-cover opacity-50"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 bg-gray-800/80 rounded-full hover:bg-gray-700 transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-6 pb-6 -mt-32 relative z-10">
        <div className="flex gap-6">
          {/* Poster */}
          <div className="flex-shrink-0">
            <img
              src={item.poster}
              alt={item.name}
              className="w-48 h-72 object-cover rounded-lg shadow-xl"
            />
          </div>

          {/* Info */}
          <div className="flex-1 pt-32">
            <h1 className="text-3xl font-bold text-white mb-2">{item.name}</h1>

            <div className="flex items-center gap-4 text-gray-400 mb-4">
              {item.year && <span>{item.year}</span>}
              {item.rating && <span>Rating: {item.rating}</span>}
              {contentType === 'movie' && movieItem.duration && (
                <span>{movieItem.duration}</span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
              {contentType === 'movie' && (
                <>
                  <button
                    onClick={() => handlePlay()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play
                  </button>
                  <button
                    onClick={() => handleAdditionalPlayers()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Additional Players
                  </button>
                </>
              )}

              <button
                onClick={() => handleCopyUrl()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                {copiedId === itemId && preferences.showCopyConfirmation ? (
                  <>
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy URL
                  </>
                )}
              </button>

              <button
                onClick={handleToggleFavorite}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  isFavorite
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {isFavorite ? 'Remove Favorite' : 'Add Favorite'}
              </button>
            </div>

            {/* Plot */}
            {item.plot && (
              <p className="text-gray-300 leading-relaxed">{item.plot}</p>
            )}
          </div>
        </div>

        {/* Episodes (for series) */}
        {contentType === 'series' && (
          <div className="mt-8">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xl font-semibold text-white">Episodes</h2>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {Array.from({ length: seriesItem.seasons?.length || 5 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>Season {num}</option>
                ))}
              </select>
            </div>

            {loadingEpisodes ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-gray-400 font-mono w-8">{episode.episodeNumber}</span>
                    <div className="flex-1">
                      <p className="text-white font-medium">{episode.title}</p>
                      {episode.duration && (
                        <p className="text-sm text-gray-400">{episode.duration}</p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleCopyUrl(episode.id)}
                        className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                        title="Copy URL"
                      >
                        {copiedId === episode.id ? (
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handlePlay(episode.id)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        title="Play"
                      >
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleAdditionalPlayers(episode.id)}
                        className="px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                        title="Additional Players"
                      >
                        More
                      </button>
                    </div>
                  </div>
                ))}

                {episodes.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No episodes available for this season</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
