import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { useSettingsStore, useRefreshStore } from '../store';
import type { RefreshStats } from '../store';
import { GroupManager } from '../components/GroupManager';
import { getApi, initApi, testConnection, XtreamApiError } from '../api';
import { normalizeServerUrl, generateId } from '../utils';
import type { ContentType } from '../types';
import type { ServerConnection } from '../types';

function getCacheStats(serverId: string): RefreshStats {
  const cache = useSettingsStore.getState().contentCache[serverId];
  if (!cache) return { liveCategories: 0, movieCategories: 0, seriesCategories: 0, channels: 0, movies: 0, series: 0, lastUpdated: 0 };
  const countItems = (record: Record<number, unknown[]>) =>
    Object.values(record).reduce((sum, arr) => sum + arr.length, 0);
  return {
    liveCategories: cache.categories.live.length,
    movieCategories: cache.categories.movie.length,
    seriesCategories: cache.categories.series.length,
    channels: countItems(cache.channels),
    movies: countItems(cache.movies),
    series: countItems(cache.series),
    lastUpdated: cache.lastUpdated,
  };
}

// Run refresh detached from component lifecycle so it survives navigation
async function runFullRefresh(serverId: string, visibleOnly: boolean) {
  const api = getApi();
  if (!api) return;

  const refreshStore = useRefreshStore.getState();
  refreshStore.startRefresh();

  const { clearCache, setCachedCategories, groupVisibility } = useSettingsStore.getState();
  const serverVisibility = groupVisibility[serverId] || {};
  const isVisible = (type: string, id: number) => serverVisibility[`${type}_${id}`] !== false;

  // Clear everything
  useRefreshStore.getState().setProgress('Clearing cache…', 0);
  clearCache(serverId);
  useAppStore.getState().setCategories('live', []);
  useAppStore.getState().setCategories('movie', []);
  useAppStore.getState().setCategories('series', []);
  useAppStore.getState().setChannels([]);
  useAppStore.getState().setMovies([]);
  useAppStore.getState().setSeries([]);

  const favorites = useSettingsStore.getState().favorites[serverId] || { live: [], movie: [], series: [] };

  try {
    // Step 1: Fetch all categories
    useRefreshStore.getState().setProgress('Fetching Live TV categories…', 5);
    const liveCatsRaw = await api.getLiveCategories();
    const liveCatsAll = api.transformCategories(liveCatsRaw, 'live');
    useAppStore.getState().setCategories('live', liveCatsAll);
    setCachedCategories(serverId, 'live', liveCatsAll);
    if (useRefreshStore.getState().shouldStop) { useRefreshStore.getState().finishRefresh(getCacheStats(serverId)); return; }

    useRefreshStore.getState().setProgress('Fetching Movie categories…', 10);
    const movieCatsRaw = await api.getVodCategories();
    const movieCatsAll = api.transformCategories(movieCatsRaw, 'movie');
    useAppStore.getState().setCategories('movie', movieCatsAll);
    setCachedCategories(serverId, 'movie', movieCatsAll);
    if (useRefreshStore.getState().shouldStop) { useRefreshStore.getState().finishRefresh(getCacheStats(serverId)); return; }

    useRefreshStore.getState().setProgress('Fetching Series categories…', 15);
    const seriesCatsRaw = await api.getSeriesCategories();
    const seriesCatsAll = api.transformCategories(seriesCatsRaw, 'series');
    useAppStore.getState().setCategories('series', seriesCatsAll);
    setCachedCategories(serverId, 'series', seriesCatsAll);
    if (useRefreshStore.getState().shouldStop) { useRefreshStore.getState().finishRefresh(getCacheStats(serverId)); return; }

    // Step 2: Filter to visible categories if requested
    const liveCats = visibleOnly ? liveCatsAll.filter((c) => isVisible('live', c.id)) : liveCatsAll;
    const movieCats = visibleOnly ? movieCatsAll.filter((c) => isVisible('movie', c.id)) : movieCatsAll;
    const seriesCats = visibleOnly ? seriesCatsAll.filter((c) => isVisible('series', c.id)) : seriesCatsAll;

    // Step 3: Fetch content per category
    const steps: { type: ContentType; label: string; cats: { id: number }[] }[] = [
      { type: 'live', label: 'Live TV', cats: liveCats },
      { type: 'movie', label: 'Movies', cats: movieCats },
      { type: 'series', label: 'Series', cats: seriesCats },
    ];

    const totalCats = liveCats.length + movieCats.length + seriesCats.length;
    let completedCats = 0;

    for (const step of steps) {
      for (const cat of step.cats) {
        if (useRefreshStore.getState().shouldStop) {
          useRefreshStore.getState().finishRefresh(getCacheStats(serverId));
          return;
        }

        completedCats++;
        const pct = 15 + Math.round((completedCats / totalCats) * 80);
        useRefreshStore.getState().setProgress(`${step.label} (${completedCats}/${totalCats})…`, pct);

        try {
          if (step.type === 'live') {
            const streams = await api.getLiveStreams(cat.id);
            const items = api.transformChannels(streams, favorites.live);
            useSettingsStore.getState().setCachedContent(serverId, 'live', cat.id, items);
          } else if (step.type === 'movie') {
            const vods = await api.getVodStreams(cat.id);
            const items = api.transformMovies(vods, favorites.movie);
            useSettingsStore.getState().setCachedContent(serverId, 'movie', cat.id, items);
          } else {
            const seriesList = await api.getSeries(cat.id);
            const items = api.transformSeriesList(seriesList, favorites.series);
            useSettingsStore.getState().setCachedContent(serverId, 'series', cat.id, items);
          }
        } catch (err) {
          console.error(`Failed to fetch ${step.type} category ${cat.id}:`, err);
        }
      }
    }

    useRefreshStore.getState().setProgress('Done!', 100);
    const stats = getCacheStats(serverId);
    setTimeout(() => useRefreshStore.getState().finishRefresh(stats), 1000);
  } catch (err) {
    console.error('Full refresh failed:', err);
    useRefreshStore.getState().setProgress('Refresh failed', 0);
    setTimeout(() => useRefreshStore.getState().finishRefresh(getCacheStats(serverId)), 2000);
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addServerStatus, setAddServerStatus] = useState<'idle' | 'connecting' | 'error'>('idle');
  const [addServerError, setAddServerError] = useState('');
  const [connectingServerId, setConnectingServerId] = useState<string | null>(null);
  const [editingNameServerId, setEditingNameServerId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const { currentServer, setCurrentServer, setAuthInfo, setConnected } = useAppStore();
  const { preferences, setPreferences, servers, addServer, updateServer, removeServer } = useSettingsStore();
  const { isRefreshing, progress, percent, stats, requestStop } = useRefreshStore();

  const serverId = currentServer?.id || '';

  // Load stats on mount (from store or compute fresh)
  const [localStats, setLocalStats] = useState<RefreshStats | null>(null);
  useEffect(() => {
    if (serverId) {
      // Use store stats if available, otherwise compute from cache
      const storeStats = useRefreshStore.getState().stats;
      setLocalStats(storeStats || getCacheStats(serverId));
    }
  }, [serverId, stats]);

  const displayStats = stats || localStats;

  const handleFullRefresh = useCallback(() => {
    if (!serverId || isRefreshing) return;
    runFullRefresh(serverId, visibleOnly);
  }, [serverId, isRefreshing, visibleOnly]);

  const handleAddServer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const url = newServerUrl.trim();
    const username = newUsername.trim();
    const password = newPassword.trim();
    if (!url || !username || !password) return;
    setAddServerStatus('connecting');
    setAddServerError('');
    const normalizedUrl = normalizeServerUrl(url);
    const hostname = new URL(normalizedUrl).hostname;
    const serverConnection: ServerConnection = {
      id: generateId(),
      name: newDisplayName.trim() || hostname,
      url: normalizedUrl,
      username,
      password,
      lastConnected: null,
    };
    try {
      await testConnection(serverConnection);
      serverConnection.lastConnected = Date.now();
      addServer(serverConnection);
      setNewServerUrl('');
      setNewDisplayName('');
      setNewUsername('');
      setNewPassword('');
      setAddServerStatus('idle');
    } catch (err) {
      setAddServerStatus('error');
      if (err instanceof XtreamApiError) {
        setAddServerError(err.isTimeout ? 'Connection timeout.' : err.isNetworkError ? 'Network error.' : err.message);
      } else {
        setAddServerError('Connection failed.');
      }
    }
  }, [newServerUrl, newDisplayName, newUsername, newPassword, addServer]);

  const handleStartEditName = (server: ServerConnection) => {
    setEditingNameServerId(server.id);
    setEditingNameValue(server.name);
  };
  const handleSaveEditName = () => {
    if (!editingNameServerId || !editingNameValue.trim()) {
      setEditingNameServerId(null);
      return;
    }
    const server = servers.find((s) => s.id === editingNameServerId);
    if (server) {
      updateServer({ ...server, name: editingNameValue.trim() });
      if (currentServer?.id === editingNameServerId) {
        useAppStore.getState().setCurrentServer({ ...currentServer, name: editingNameValue.trim() });
      }
    }
    setEditingNameServerId(null);
    setEditingNameValue('');
  };

  const handleConnectServer = useCallback(async (server: ServerConnection) => {
    setConnectingServerId(server.id);
    try {
      const authResponse = await testConnection(server);
      const updated = { ...server, lastConnected: Date.now() };
      updateServer(updated);
      initApi(updated);
      setCurrentServer(updated);
      setAuthInfo(authResponse);
      setConnected(true);
      navigate('/live', { replace: true });
    } catch {
      setConnectingServerId(null);
    }
  }, [updateServer, setCurrentServer, setAuthInfo, setConnected, navigate]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* Group Management */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Group Management</h2>
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Manage Groups</p>
              <p className="text-sm text-gray-400">Show/hide categories and create custom groups</p>
            </div>
            <button
              onClick={() => setShowGroupManager(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Manage
            </button>
          </div>
        </div>
      </section>

      {/* Clipboard Settings */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Clipboard</h2>
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-white">Show copy confirmation</p>
              <p className="text-sm text-gray-400">Display checkmark when URL is copied</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.showCopyConfirmation}
              onChange={(e) => setPreferences({ showCopyConfirmation: e.target.checked })}
              className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <p className="text-white">Hide credentials in URL display</p>
              <p className="text-sm text-gray-400">Mask username/password when showing URLs</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.hideCredentialsInUrl}
              onChange={(e) => setPreferences({ hideCredentialsInUrl: e.target.checked })}
              className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>
      </section>

      {/* Display Preferences */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Display</h2>
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Default view</p>
              <p className="text-sm text-gray-400">How content is displayed by default</p>
            </div>
            <select
              value={preferences.defaultView}
              onChange={(e) => setPreferences({ defaultView: e.target.value as 'grid' | 'list' })}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </div>
        </div>
      </section>

      {/* Data & Cache */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Data & Cache</h2>
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          {/* Refresh from server */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <p className="text-white">Refresh from server</p>
                <p className="text-sm text-gray-400">
                  Clear local cache and re-fetch all categories and content from the Xtream server
                </p>
              </div>
              {!isRefreshing ? (
                <button
                  onClick={handleFullRefresh}
                  disabled={!serverId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh All
                </button>
              ) : (
                <button
                  onClick={requestStop}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex-shrink-0 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Stop
                </button>
              )}
            </div>

            {/* Visible only toggle */}
            {!isRefreshing && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleOnly}
                  onChange={(e) => setVisibleOnly(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-400">Only refresh visible groups</span>
              </label>
            )}

            {/* Progress bar */}
            {isRefreshing && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-gray-400">{progress}</p>
                </div>
              </div>
            )}

            {/* Cache stats */}
            {!isRefreshing && displayStats && (displayStats.liveCategories > 0 || displayStats.movieCategories > 0 || displayStats.seriesCategories > 0) && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-red-400">{displayStats.channels.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{displayStats.liveCategories} categories</p>
                  <p className="text-xs text-gray-500 mt-1">Live TV</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">{displayStats.movies.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{displayStats.movieCategories} categories</p>
                  <p className="text-xs text-gray-500 mt-1">Movies</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-purple-400">{displayStats.series.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{displayStats.seriesCategories} categories</p>
                  <p className="text-xs text-gray-500 mt-1">Series</p>
                </div>
              </div>
            )}

            {/* Last updated */}
            {!isRefreshing && displayStats && displayStats.lastUpdated > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Last refreshed: {new Date(displayStats.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* API endpoints: Add new + Saved list */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">API Endpoints</h2>

        {/* Add new endpoint */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <p className="text-white font-medium mb-3">Add new Xtream API endpoint</p>
          <form onSubmit={handleAddServer} className="space-y-3">
            <input
              type="text"
              value={newServerUrl}
              onChange={(e) => {
                const v = e.target.value;
                setNewServerUrl(v);
                try {
                  const norm = normalizeServerUrl(v);
                  const host = new URL(norm).hostname;
                  if (host && !newDisplayName) setNewDisplayName(host);
                } catch {
                  /* ignore */
                }
              }}
              placeholder="Server URL (e.g. http://example.com:8080)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
              disabled={addServerStatus === 'connecting'}
            />
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Display name (e.g. My IPTV — shown instead of URL)"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
              disabled={addServerStatus === 'connecting'}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                disabled={addServerStatus === 'connecting'}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                disabled={addServerStatus === 'connecting'}
              />
            </div>
            {addServerStatus === 'error' && addServerError && (
              <p className="text-sm text-red-400">{addServerError}</p>
            )}
            <button
              type="submit"
              disabled={!newServerUrl.trim() || !newUsername.trim() || !newPassword.trim() || addServerStatus === 'connecting'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {addServerStatus === 'connecting' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Test & save…
                </>
              ) : (
                'Test & save'
              )}
            </button>
          </form>
        </div>

        {/* Saved servers */}
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-white font-medium mb-3">Saved servers</p>
          {servers.length > 0 ? (
            <div className="space-y-3">
              {servers.map((server) => (
                <div key={server.id} className="flex items-center justify-between gap-3 p-3 bg-gray-700 rounded-lg flex-wrap">
                  <div className="min-w-0 flex-1">
                    {editingNameServerId === server.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEditName()}
                          onBlur={handleSaveEditName}
                          className="flex-1 min-w-0 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditName}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <p className="text-white font-medium">{server.name}</p>
                    )}
                    <p className="text-sm text-gray-400 truncate">{server.url}</p>
                    {server.lastConnected && (
                      <p className="text-xs text-gray-500">
                        Last connected: {new Date(server.lastConnected).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingNameServerId !== server.id && (
                      <button
                        onClick={() => handleStartEditName(server)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                        title="Edit display name"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleConnectServer(server)}
                      disabled={connectingServerId !== null || currentServer?.id === server.id}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-default text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      title={currentServer?.id === server.id ? 'Current server' : 'Connect to this server'}
                    >
                      {connectingServerId === server.id ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Connecting…
                        </>
                      ) : currentServer?.id === server.id ? (
                        'Current'
                      ) : (
                        'Connect'
                      )}
                    </button>
                    <button
                      onClick={() => removeServer(server.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Remove server"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No saved servers. Add one above or sign in on the Login page.</p>
          )}
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Keyboard Shortcuts</h2>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Arrow keys', 'Navigate'],
              ['Enter', 'Select / Play'],
              ['Backspace', 'Go back'],
              ['F', 'Toggle favorite'],
              ['S', 'Open search'],
              ['Escape', 'Exit / Close'],
              ['Space', 'Play / Pause'],
              ['H', 'Hide current group'],
              ['Ctrl+H', 'Hide all groups'],
              ['C', 'Copy stream URL'],
            ].map(([key, action]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-gray-400">{action}</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-white font-mono">{key}</kbd>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">About</h2>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <h3 className="text-xl font-bold text-white mb-1">TvX</h3>
          <p className="text-gray-400">IPTV Client for Xtream Codes</p>
          <p className="text-gray-500 text-sm mt-2">Version 0.1.0</p>
        </div>
      </section>

      {/* Group Manager Modal */}
      {showGroupManager && <GroupManager onClose={() => setShowGroupManager(false)} />}
    </div>
  );
}
