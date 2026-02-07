import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, useSettingsStore } from '../store';
import { getApi } from '../api';
import { copyToClipboard } from '../utils';
import { invoke } from '@tauri-apps/api/core';
import { AddToGroupMenu } from './AddToGroupMenu';
import type { Channel, Movie, Series, ContentType } from '../types';

interface ContentGridProps {
  type: ContentType;
  items: (Channel | Movie | Series)[];
  loading?: boolean;
  onItemClick?: (item: Channel | Movie | Series) => void;
}

export function ContentGrid({ type, items, loading, onItemClick }: ContentGridProps) {
  const navigate = useNavigate();
  const { currentServer } = useAppStore();
  const { preferences, addFavorite, removeFavorite, favorites } = useSettingsStore();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Channel | Movie | Series } | null>(null);
  const [showAddToGroupMenu, setShowAddToGroupMenu] = useState(false);

  const serverId = currentServer?.id || '';
  const serverFavorites = favorites[serverId]?.[type] || [];
  const { addToWatchHistory } = useSettingsStore();

  const handleItemClick = useCallback(
    async (item: Channel | Movie | Series) => {
      if (onItemClick) {
        onItemClick(item);
        return;
      }
      const api = getApi();
      if (!api) return;

      if (type === 'live') {
        const streamUrl = api.buildLiveStreamUrl(item.id, 'm3u8');
        try {
          await invoke('open_video_window', {
            title: item.name,
            streamUrl,
            startPositionSecs: undefined,
            serverId: serverId || undefined,
            contentType: 'live',
            contentId: item.id,
          });
          if (serverId) {
            addToWatchHistory(serverId, {
              contentType: 'live',
              contentId: item.id,
              timestamp: Date.now(),
              title: item.name,
            });
          }
        } catch (err) {
          console.error('Failed to open video window:', err);
        }
      } else if (type === 'movie') {
        const ext = (item as Movie).extension || 'mp4';
        const streamUrl = api.buildVodStreamUrl(item.id, ext);
        try {
          await invoke('open_video_window', {
            title: item.name,
            streamUrl,
            startPositionSecs: undefined,
            serverId: serverId || undefined,
            contentType: 'movie',
            contentId: item.id,
          });
          if (serverId) {
            addToWatchHistory(serverId, {
              contentType: 'movie',
              contentId: item.id,
              timestamp: Date.now(),
              title: item.name,
              extension: ext,
            });
          }
        } catch (err) {
          console.error('Failed to open video window:', err);
        }
      } else {
        navigate(`/detail/${type}/${item.id}`);
      }
    },
    [onItemClick, type, serverId, addToWatchHistory, navigate]
  );

  const handleCopyUrl = useCallback(async (item: Channel | Movie | Series, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const api = getApi();
    if (!api) return;

    let url: string;
    if (type === 'live') {
      url = api.buildLiveStreamUrl(item.id);
    } else if (type === 'movie') {
      url = api.buildVodStreamUrl(item.id, 'mp4');
    } else {
      url = api.buildSeriesStreamUrl(item.id, 'mp4');
    }

    const success = await copyToClipboard(url);
    if (success) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
    setContextMenu(null);
  }, [type]);

  const handleToggleFavorite = (item: Channel | Movie | Series, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (serverFavorites.includes(item.id)) {
      removeFavorite(serverId, type, item.id);
    } else {
      addFavorite(serverId, type, item.id);
    }
    useAppStore.getState().toggleFavorite(type, item.id);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, item: Channel | Movie | Series) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setShowAddToGroupMenu(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">Loading content...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <div className="w-24 h-24 mb-6 rounded-full bg-gray-800/50 flex items-center justify-center">
          <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        </div>
        <p className="text-lg font-medium">No content available</p>
        <p className="text-sm text-gray-500 mt-1">Try selecting a different category</p>
      </div>
    );
  }

  // Use compact layout for live channels, card layout for movies/series
  if (type === 'live') {
    return (
      <div onClick={closeContextMenu}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {items.map((item) => (
            <ChannelCard
              key={item.id}
              channel={item as Channel}
              isFavorite={serverFavorites.includes(item.id)}
              isCopied={copiedId === item.id}
              showCopyConfirmation={preferences.showCopyConfirmation}
              onClick={() => handleItemClick(item)}
              onCopyUrl={(e) => handleCopyUrl(item, e)}
              onToggleFavorite={(e) => handleToggleFavorite(item, e)}
              onContextMenu={(e) => handleContextMenu(e, item)}
            />
          ))}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
            <div
              className="fixed bg-[#1a1a24] border border-gray-700/50 rounded-xl shadow-2xl py-2 z-50 min-w-[200px] backdrop-blur-xl"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  navigate(`/player/${type}/${contextMenu!.item.id}`);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Additional Players
              </button>
              <button
                onClick={() => handleCopyUrl(contextMenu.item)}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
              >
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Stream URL
              </button>
              <button
                onClick={() => handleToggleFavorite(contextMenu.item)}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
              >
                <svg className={`w-4 h-4 ${serverFavorites.includes(contextMenu.item.id) ? 'text-red-400' : 'text-gray-400'}`} fill={serverFavorites.includes(contextMenu.item.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {serverFavorites.includes(contextMenu.item.id) ? 'Remove from Favorites' : 'Add to Favorites'}
              </button>
              <div className="h-px bg-gray-700/50 my-1" />
              <div className="relative">
                <button
                  onClick={() => setShowAddToGroupMenu(!showAddToGroupMenu)}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                  </svg>
                  Add to Group
                  <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {showAddToGroupMenu && (
                  <div className="absolute left-full top-0 ml-1 bg-[#1a1a24] border border-gray-700/50 rounded-xl shadow-2xl py-2 min-w-[180px] backdrop-blur-xl">
                    <AddToGroupMenu
                      contentId={contextMenu.item.id}
                      contentType={type}
                      onClose={closeContextMenu}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div onClick={closeContextMenu}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            type={type}
            isFavorite={serverFavorites.includes(item.id)}
            isCopied={copiedId === item.id}
            showCopyConfirmation={preferences.showCopyConfirmation}
            onClick={() => handleItemClick(item)}
            onCopyUrl={(e) => handleCopyUrl(item, e)}
            onToggleFavorite={(e) => handleToggleFavorite(item, e)}
            onContextMenu={(e) => handleContextMenu(e, item)}
          />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed bg-[#1a1a24] border border-gray-700/50 rounded-xl shadow-2xl py-2 z-50 min-w-[200px] backdrop-blur-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {type === 'movie' && (
              <button
                onClick={() => {
                  navigate(`/player/${type}/${contextMenu!.item.id}`);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Additional Players
              </button>
            )}
            <button
              onClick={() => handleCopyUrl(contextMenu.item)}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Stream URL
            </button>
            <button
              onClick={() => handleToggleFavorite(contextMenu.item)}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
            >
              <svg className={`w-4 h-4 ${serverFavorites.includes(contextMenu.item.id) ? 'text-red-400' : 'text-gray-400'}`} fill={serverFavorites.includes(contextMenu.item.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {serverFavorites.includes(contextMenu.item.id) ? 'Remove from Favorites' : 'Add to Favorites'}
            </button>
            <div className="h-px bg-gray-700/50 my-1" />
            <div className="relative">
              <button
                onClick={() => setShowAddToGroupMenu(!showAddToGroupMenu)}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
              >
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                </svg>
                Add to Group
                <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {showAddToGroupMenu && (
                <div className="absolute left-full top-0 ml-1 bg-[#1a1a24] border border-gray-700/50 rounded-xl shadow-2xl py-2 min-w-[180px] backdrop-blur-xl">
                  <AddToGroupMenu
                    contentId={contextMenu.item.id}
                    contentType={type}
                    onClose={closeContextMenu}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ContentCardProps {
  item: Channel | Movie | Series;
  type: ContentType;
  isFavorite: boolean;
  isCopied: boolean;
  showCopyConfirmation: boolean;
  onClick: () => void;
  onCopyUrl: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function ContentCard({ item, type, isFavorite, isCopied, showCopyConfirmation, onClick, onCopyUrl, onToggleFavorite, onContextMenu }: ContentCardProps) {
  const poster = type === 'live' ? (item as Channel).icon : (item as Movie | Series).poster;
  const [imageError, setImageError] = useState(false);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group relative bg-[#16161f] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/10 hover:z-10"
    >
      {/* Poster/Icon */}
      <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
        {poster && !imageError ? (
          <img
            src={poster}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center p-4">
              <svg className="w-12 h-12 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-gray-500 line-clamp-2">{item.name}</p>
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover Actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
          {/* Play Button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={onCopyUrl}
            className="w-8 h-8 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
            title="Copy URL"
          >
            {isCopied && showCopyConfirmation ? (
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <button
            onClick={onToggleFavorite}
            className="w-8 h-8 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
            title="Toggle Favorite"
          >
            <svg className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : 'text-white'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* Favorite Badge */}
        {isFavorite && (
          <div className="absolute top-2 left-2 group-hover:opacity-0 transition-opacity">
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Live Badge */}
        {type === 'live' && (
          <div className="absolute bottom-2 left-2 group-hover:opacity-0 transition-opacity">
            <div className="px-2 py-0.5 bg-red-600 rounded text-[10px] font-bold text-white flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{item.name}</p>
        {type !== 'live' && 'year' in item && item.year && (
          <p className="text-xs text-gray-500 mt-0.5">{item.year}</p>
        )}
        {type !== 'live' && 'rating' in item && item.rating && (
          <div className="flex items-center gap-1 mt-1">
            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-xs text-gray-400">{item.rating}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact channel card for live TV
interface ChannelCardProps {
  channel: Channel;
  isFavorite: boolean;
  isCopied: boolean;
  showCopyConfirmation: boolean;
  onClick: () => void;
  onCopyUrl: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function ChannelCard({ channel, isFavorite, isCopied, showCopyConfirmation, onClick, onCopyUrl, onToggleFavorite, onContextMenu }: ChannelCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group relative bg-gradient-to-br from-[#1a1a2e] to-[#16161f] rounded-xl p-3 cursor-pointer hover:from-blue-900/30 hover:to-purple-900/30 transition-all duration-300 border border-gray-800/50 hover:border-blue-500/50 flex items-center gap-3"
    >
      {/* Channel Icon */}
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {channel.icon && !imageError ? (
          <img
            src={channel.icon}
            alt={channel.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Channel Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{channel.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-red-400 font-medium">LIVE</span>
        </div>
      </div>

      {/* Favorite indicator */}
      {isFavorite && (
        <svg className="w-4 h-4 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )}

      {/* Hover actions */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onCopyUrl}
          className="w-7 h-7 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
          title="Copy URL"
        >
          {isCopied && showCopyConfirmation ? (
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
        <button
          onClick={onToggleFavorite}
          className="w-7 h-7 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-black/80 transition-colors"
          title="Toggle Favorite"
        >
          <svg className={`w-3.5 h-3.5 ${isFavorite ? 'text-red-500 fill-current' : 'text-white'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
