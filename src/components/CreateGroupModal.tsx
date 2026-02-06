import { useState } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import type { ContentType } from '../types';

interface CreateGroupModalProps {
  defaultType: ContentType;
  onClose: () => void;
}

export function CreateGroupModal({ defaultType, onClose }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ContentType>(defaultType);
  const { currentServer } = useAppStore();
  const { createCustomGroup } = useSettingsStore();

  const serverId = currentServer?.id || '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;
    if (!serverId) return;

    const groupId = createCustomGroup(serverId, {
      name: name.trim(),
      type,
      contentIds: [],
    });

    console.log('Created group with ID:', groupId, 'for server:', serverId);

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
      <div className="bg-[#1a1a24] rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-white mb-6">Create Custom Group</h2>

        <form onSubmit={handleSubmit}>
          {/* Group Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Group Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Content Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['live', 'movie', 'series'] as ContentType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    type === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {t === 'live' ? 'Live TV' : t === 'movie' ? 'Movies' : 'Series'}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
