import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, useSettingsStore } from '../store';
import { getApi } from '../api';
import { copyToClipboard } from '../utils';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ContentType } from '../types';

export function PlayerPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { channels, movies, series, currentServer } = useAppStore();
  const { addToWatchHistory } = useSettingsStore();

  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openingExternal, setOpeningExternal] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const contentType = type as ContentType;
  const itemId = parseInt(id || '0', 10);
  const serverId = currentServer?.id || '';

  const contentInfo = (() => {
    if (contentType === 'live') {
      const channel = channels.find((c) => c.id === itemId);
      return channel ? { name: channel.name, icon: channel.icon } : null;
    } else if (contentType === 'movie') {
      const movie = movies.find((m) => m.id === itemId);
      return movie ? { name: movie.name, icon: movie.poster } : null;
    } else {
      const s = series.find((s) => s.id === itemId);
      return s ? { name: s.name, icon: s.poster } : null;
    }
  })();

  const streamUrl = (() => {
    const api = getApi();
    if (!api) return '';
    switch (contentType) {
      case 'live':
        return api.buildLiveStreamUrl(itemId, 'm3u8');
      case 'movie':
        return api.buildVodStreamUrl(itemId, 'm3u8');
      case 'series':
        return api.buildSeriesStreamUrl(itemId, 'm3u8');
      default:
        return '';
    }
  })();

  useEffect(() => {
    if (serverId && contentType && itemId) {
      addToWatchHistory(serverId, {
        contentType,
        contentId: itemId,
        timestamp: Date.now(),
      });
    }
  }, [serverId, contentType, itemId, addToWatchHistory]);

  const handleOpenInNewWindow = async () => {
    if (!streamUrl) return;
    setOpening(true);
    try {
      await invoke('open_video_window', {
        title: contentInfo?.name || 'Stream',
        streamUrl,
      });
    } catch (err) {
      console.error('Failed to open video window:', err);
    } finally {
      setOpening(false);
    }
  };

  const handleOpenExternal = async (openWith?: string) => {
    if (!streamUrl) return;
    setOpeningExternal(true);
    setExternalError(null);
    try {
      if (openWith === 'vlc') {
        await invoke('open_in_vlc', { url: streamUrl });
      } else {
        await openUrl(streamUrl, openWith as 'inAppBrowser' | string | undefined);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to open external:', err);
      setExternalError(openWith === 'vlc' ? `VLC: ${msg}` : msg);
    } finally {
      setOpeningExternal(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!streamUrl) return;
    const success = await copyToClipboard(streamUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!streamUrl) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>Stream not available.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl bg-gray-800/80 p-8 shadow-xl">
        {contentInfo && (
          <div className="flex items-center gap-4 mb-6">
            {contentInfo.icon && (
              <img
                src={contentInfo.icon}
                alt=""
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-xl font-semibold text-white">{contentInfo.name}</h1>
              {contentType === 'live' && (
                <span className="text-red-400 text-sm flex items-center gap-1 mt-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-gray-400 text-sm mb-6">
          Open in a new Tauri window, in the browser, or in VLC (if installed).
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleOpenInNewWindow}
            disabled={opening}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {opening ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in new window
              </>
            )}
          </button>

          <button
            onClick={() => handleOpenExternal()}
            disabled={openingExternal}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {openingExternal ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in browser
              </>
            )}
          </button>

          <button
            onClick={() => handleOpenExternal('vlc')}
            disabled={openingExternal}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {openingExternal ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Open with VLC
              </>
            )}
          </button>

          {externalError && (
            <p className="text-sm text-red-400 px-1">{externalError}</p>
          )}

          <button
            onClick={handleCopyUrl}
            className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <span className="text-green-400">Copied!</span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy stream URL
              </>
            )}
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
