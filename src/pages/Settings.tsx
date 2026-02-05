import { useSettingsStore, useAppStore } from '../store';

export function SettingsPage() {
  const { preferences, setPreferences, servers, removeServer, setAllGroupsVisibility } = useSettingsStore();
  const { categories, currentServer } = useAppStore();

  const serverId = currentServer?.id || '';
  const allCategoryIds = [
    ...categories.live.map((c) => c.id),
    ...categories.movie.map((c) => c.id),
    ...categories.series.map((c) => c.id),
  ];

  const handleExpandAll = () => {
    setAllGroupsVisibility(serverId, true, allCategoryIds);
  };

  const handleCollapseAll = () => {
    setAllGroupsVisibility(serverId, false, allCategoryIds);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* Group Behavior */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Group Behavior</h2>
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-white">Show one group at a time</p>
              <p className="text-sm text-gray-400">Expanding one group will collapse others (accordion mode)</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.showOneGroupAtATime}
              onChange={(e) => setPreferences({ showOneGroupAtATime: e.target.checked })}
              className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleExpandAll}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Expand All Groups
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Collapse All Groups
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

      {/* Saved Servers */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Saved Servers</h2>
        <div className="bg-gray-800 rounded-lg p-4">
          {servers.length > 0 ? (
            <div className="space-y-3">
              {servers.map((server) => (
                <div key={server.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{server.name}</p>
                    <p className="text-sm text-gray-400">{server.url}</p>
                    {server.lastConnected && (
                      <p className="text-xs text-gray-500">
                        Last connected: {new Date(server.lastConnected).toLocaleDateString()}
                      </p>
                    )}
                  </div>
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
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No saved servers</p>
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
    </div>
  );
}
