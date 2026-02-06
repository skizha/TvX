import { useState, useMemo } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import { CreateGroupModal } from './CreateGroupModal';
import type { ContentType } from '../types';

interface GroupManagerProps {
  onClose: () => void;
}

export function GroupManager({ onClose }: GroupManagerProps) {
  const [activeTab, setActiveTab] = useState<ContentType>('live');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { categories, currentServer } = useAppStore();
  const { groupVisibility, setGroupVisibility, setAllGroupsVisibility, customGroups, deleteCustomGroup } = useSettingsStore();

  const serverId = currentServer?.id || '';
  const serverVisibilityRaw = groupVisibility[serverId] || {};
  const visibilityKey = (id: string | number) => `${activeTab}_${String(id)}`;
  const serverVisibility = (id: string | number) => serverVisibilityRaw[visibilityKey(id)] !== false;
  const serverGroups = customGroups[serverId] || [];

  const tabs: { type: ContentType; label: string }[] = [
    { type: 'live', label: 'Live TV' },
    { type: 'movie', label: 'Movies' },
    { type: 'series', label: 'Series' },
  ];

  // Combine API categories with custom groups
  const allCategories = useMemo(() => {
    const apiCategories = categories[activeTab] || [];
    const customGroupsForType = serverGroups.filter((g) => g.type === activeTab);
    return { apiCategories, customGroups: customGroupsForType };
  }, [categories, activeTab, serverGroups]);

  const handleToggleVisibility = (id: number | string, currentlyVisible: boolean) => {
    setGroupVisibility(serverId, activeTab, id, !currentlyVisible);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (confirm('Are you sure you want to delete this group?')) {
      deleteCustomGroup(serverId, groupId);
    }
  };

  const handleCreateGroup = () => {
    setShowCreateModal(true);
  };

  const allGroupIds = [
    ...allCategories.customGroups.map((g) => g.id),
    ...allCategories.apiCategories.map((c) => c.id),
  ];
  const hasAnyGroups = allGroupIds.length > 0;
  const allVisible =
    hasAnyGroups &&
    allGroupIds.every((id) => serverVisibility(id));

  const handleToggleAll = () => {
    if (hasAnyGroups) setAllGroupsVisibility(serverId, activeTab, !allVisible, allGroupIds);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#1a1a24] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white">Manage Groups</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50">
          {tabs.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.type
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Create Custom Group Button */}
          <button
            onClick={handleCreateGroup}
            className="w-full mb-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Custom Group
          </button>

          {/* Hide all / Show all – single control for both sections, right-aligned, distinct from list */}
          {hasAnyGroups && (
            <div className="flex justify-end items-center gap-2 mb-3">
              <span className="text-xs text-gray-400">
                {allVisible ? 'Hide all' : 'Show all'}
              </span>
              <button
                type="button"
                onClick={handleToggleAll}
                className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
                  allVisible ? 'bg-blue-600' : 'bg-gray-600'
                }`}
                title={allVisible ? 'Hide all groups and categories' : 'Show all groups and categories'}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    allVisible ? 'left-4' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Custom Groups Section */}
          {allCategories.customGroups.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Custom Groups</h3>
              <div className="space-y-2">
                {allCategories.customGroups.map((group) => (
                  <GroupItem
                    key={group.id}
                    name={group.name}
                    isVisible={serverVisibility(group.id)}
                    isCustom
                    contentCount={group.contentIds.length}
                    onToggle={() => handleToggleVisibility(group.id, serverVisibility(group.id))}
                    onDelete={() => handleDeleteGroup(group.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* API Categories Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Categories</h3>
            <div className="space-y-2">
              {allCategories.apiCategories.map((category) => (
                <GroupItem
                  key={category.id}
                  name={category.name}
                  isVisible={serverVisibility(category.id)}
                  isCustom={false}
                  onToggle={() => handleToggleVisibility(category.id, serverVisibility(category.id))}
                />
              ))}
            </div>

            {allCategories.apiCategories.length === 0 && allCategories.customGroups.length === 0 && (
              <p className="text-gray-500 text-center py-8">No categories available. Connect to a server to see categories.</p>
            )}
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          defaultType={activeTab}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

interface GroupItemProps {
  name: string;
  isVisible: boolean;
  isCustom: boolean;
  contentCount?: number;
  onToggle: () => void;
  onDelete?: () => void;
}

function GroupItem({ name, isVisible, isCustom, contentCount, onToggle, onDelete }: GroupItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className={`w-10 h-6 rounded-full transition-colors relative ${
            isVisible ? 'bg-blue-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              isVisible ? 'left-5' : 'left-1'
            }`}
          />
        </button>
        <div>
          <p className="text-white font-medium">{name}</p>
          {isCustom && (
            <p className="text-xs text-gray-500">
              {contentCount === 0 ? 'Empty' : `${contentCount} item${contentCount === 1 ? '' : 's'}`}
            </p>
          )}
        </div>
      </div>

      {isCustom && onDelete && (
        <button
          onClick={onDelete}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
          title="Delete group"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
