import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, useSettingsStore } from '../store';
import { initApi, testConnection, XtreamApiError } from '../api';
import { normalizeServerUrl, generateId } from '../utils';
import type { ServerConnection } from '../types';

type ConnectionStatus = 'idle' | 'connecting' | 'success' | 'error';

export function LoginPage() {
  const navigate = useNavigate();
  const { setCurrentServer, setAuthInfo, setConnected, setConnecting } = useAppStore();
  const { servers, addServer, updateServer } = useSettingsStore();

  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (servers.length > 0) {
      const lastServer = servers[0];
      setSelectedServerId(lastServer.id);
      setServerUrl(lastServer.url);
      setUsername(lastServer.username);
      setPassword(lastServer.password);
    }
  }, [servers]);

  const handleServerSelect = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (server) {
      setSelectedServerId(serverId);
      setServerUrl(server.url);
      setUsername(server.username);
      setPassword(server.password);
    }
  };

  const handleNewServer = () => {
    setSelectedServerId(null);
    setServerUrl('');
    setUsername('');
    setPassword('');
  };

  const isFormValid = serverUrl.trim() && username.trim() && password.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setStatus('connecting');
    setConnecting(true);
    setErrorMessage('');

    const normalizedUrl = normalizeServerUrl(serverUrl);
    const serverConnection: ServerConnection = {
      id: selectedServerId || generateId(),
      name: new URL(normalizedUrl).hostname,
      url: normalizedUrl,
      username: username.trim(),
      password: password.trim(),
      lastConnected: null,
    };

    try {
      const authResponse = await testConnection(serverConnection);
      serverConnection.lastConnected = Date.now();

      if (rememberCredentials) {
        if (selectedServerId) {
          updateServer(serverConnection);
        } else {
          addServer(serverConnection);
        }
      }

      initApi(serverConnection);
      setCurrentServer(serverConnection);
      setAuthInfo(authResponse);
      setConnected(true);
      setConnecting(false);
      setStatus('success');

      setTimeout(() => navigate('/live'), 500);
    } catch (err) {
      setConnecting(false);
      setStatus('error');
      if (err instanceof XtreamApiError) {
        if (err.isTimeout) {
          setErrorMessage('Connection timeout. Please check the server URL.');
        } else if (err.isNetworkError) {
          setErrorMessage('Unable to connect. Please check your internet connection.');
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">TvX</h1>
          <p className="text-gray-400">IPTV Client</p>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-2xl p-6">
          {servers.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Saved Servers</label>
              <div className="flex gap-2 flex-wrap">
                {servers.map((server) => (
                  <button
                    key={server.id}
                    onClick={() => handleServerSelect(server.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedServerId === server.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {server.name}
                  </button>
                ))}
                <button
                  onClick={handleNewServer}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    !selectedServerId ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  + New
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="serverUrl" className="block text-sm font-medium text-gray-300 mb-1">Server URL</label>
              <input
                id="serverUrl"
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://example.com:8080"
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                disabled={status === 'connecting'}
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                disabled={status === 'connecting'}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                disabled={status === 'connecting'}
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberCredentials}
                onChange={(e) => setRememberCredentials(e.target.checked)}
                className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-blue-600"
                disabled={status === 'connecting'}
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-300">Remember credentials</label>
            </div>

            {status === 'error' && errorMessage && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-sm text-red-300">{errorMessage}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="p-3 bg-green-900/50 border border-green-700 rounded-lg">
                <p className="text-sm text-green-300">Connected! Redirecting...</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!isFormValid || status === 'connecting'}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {status === 'connecting' ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
