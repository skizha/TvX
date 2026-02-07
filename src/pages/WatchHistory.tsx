import { useState } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import { getApi } from '../api';
import { invoke } from '@tauri-apps/api/core';
import type { WatchHistoryEntry, ContentType } from '../types';

function formatRelativeTime(timestamp: number): string {
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function typeLabel(type: ContentType): string {
  switch (type) {
    case 'live': return 'Live TV';
    case 'movie': return 'Movie';
    case 'series': return 'Series';
  }
}

function displayTitle(
  entry: WatchHistoryEntry,
  channels: { id: number; name: string }[],
  movies: { id: number; name: string }[]
): string {
  if (entry.title) return entry.title;
  if (entry.contentType === 'live') {
    const ch = channels.find((c) => c.id === entry.contentId);
    return ch?.name ?? `Channel ${entry.contentId}`;
  }
  if (entry.contentType === 'movie') {
    const m = movies.find((mo) => mo.id === entry.contentId);
    return m?.name ?? `Movie ${entry.contentId}`;
  }
  return `Episode ${entry.contentId}`;
}

export function WatchHistoryPage() {
  const { currentServer, channels, movies } = useAppStore();
  const { watchHistory, clearWatchHistory } = useSettingsStore();
  const [resumingId, setResumingId] = useState<string | null>(null);

  const serverId = currentServer?.id ?? '';
  const entries = (watchHistory[serverId] ?? []).slice(0, 50);

  const handleResume = async (entry: WatchHistoryEntry) => {
    const api = getApi();
    if (!api) return;
    const key = `${entry.contentType}-${entry.contentId}-${entry.timestamp}`;
    setResumingId(key);
    try {
      let streamUrl: string;
      const ext = entry.extension ?? 'mp4';
      switch (entry.contentType) {
        case 'live':
          streamUrl = api.buildLiveStreamUrl(entry.contentId, 'm3u8');
          break;
        case 'movie':
          streamUrl = api.buildVodStreamUrl(entry.contentId, ext);
          break;
        case 'series':
          streamUrl = api.buildSeriesStreamUrl(entry.contentId, ext);
          break;
        default:
          setResumingId(null);
          return;
      }
      const title = entry.title ?? displayTitle(entry, channels, movies);
      const startSecs = entry.progress && entry.progress > 0 ? entry.progress : undefined;
      await invoke('open_video_window', {
        title,
        streamUrl,
        startPositionSecs: startSecs,
        serverId: serverId || undefined,
        contentType: entry.contentType,
        contentId: entry.contentId,
      });
    } catch (err) {
      console.error('Failed to open video window:', err);
    } finally {
      setResumingId(null);
    }
  };

  if (!serverId) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Connect to a server to see watch history.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Watch History</h1>
        {entries.length > 0 && (
          <button
            onClick={() => clearWatchHistory(serverId)}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Clear history
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-12 text-center">
          <p className="text-gray-400">No watch history yet.</p>
          <p className="text-sm text-gray-500 mt-1">Play something from Live TV, Movies, or Series to see it here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const key = `${entry.contentType}-${entry.contentId}-${entry.timestamp}`;
            const title = displayTitle(entry, channels, movies);
            const isResuming = resumingId === key;
            return (
              <li
                key={key}
                className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500">{typeLabel(entry.contentType)}</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-xs text-gray-500">{formatRelativeTime(entry.timestamp)}</span>
                    {entry.progress != null && entry.progress > 0 && (
                      <>
                        <span className="text-xs text-gray-500">·</span>
                        <span className="text-xs text-gray-500">{Math.floor(entry.progress / 60)}m watched</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleResume(entry)}
                  disabled={isResuming}
                  className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isResuming ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Opening…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Resume
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
