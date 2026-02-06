import { useState, useMemo } from 'react';
import { useAppStore, useSettingsStore } from '../store';
import type { Category, ContentType } from '../types';

interface CategoryBrowserProps {
  type: ContentType;
  onCategorySelect: (categoryId: number | null) => void;
  selectedCategoryId: number | null;
}

export function CategoryBrowser({ type, onCategorySelect, selectedCategoryId }: CategoryBrowserProps) {
  const categories = useAppStore((state) => state.categories[type]);
  const currentServer = useAppStore((state) => state.currentServer);
  const { preferences, groupVisibility, setGroupVisibility, setAllGroupsVisibility } = useSettingsStore();

  const serverId = currentServer?.id || '';
  const serverVisibilityRaw = groupVisibility[serverId] || {};
  const isCategoryExpanded = (categoryId: number) =>
    serverVisibilityRaw[`${type}_${categoryId}`] !== false;

  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter((cat) => cat.name.toLowerCase().includes(query));
  }, [categories, searchQuery]);

  const toggleCategory = (categoryId: number) => {
    const isCurrentlyVisible = isCategoryExpanded(categoryId);

    if (preferences.showOneGroupAtATime && !isCurrentlyVisible) {
      // Collapse all others, expand this one
      const allIds = categories.map((c) => c.id);
      setAllGroupsVisibility(serverId, type, false, allIds);
      setGroupVisibility(serverId, type, categoryId, true);
    } else {
      setGroupVisibility(serverId, type, categoryId, !isCurrentlyVisible);
    }
  };

  const handleHideAll = () => {
    const allIds = categories.map((c) => c.id);
    setAllGroupsVisibility(serverId, type, false, allIds);
  };

  const handleShowAll = () => {
    const allIds = categories.map((c) => c.id);
    setAllGroupsVisibility(serverId, type, true, allIds);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Categories</h3>
        <div className="flex gap-2">
          <button
            onClick={handleShowAll}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            title="Show all groups"
          >
            Show All
          </button>
          <button
            onClick={handleHideAll}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            title="Hide all groups (Ctrl+H)"
          >
            Hide All
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories..."
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* All Button */}
      <button
        onClick={() => onCategorySelect(null)}
        className={`w-full text-left px-3 py-2 rounded-lg mb-2 transition-colors ${
          selectedCategoryId === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        All ({type === 'live' ? 'Channels' : type === 'movie' ? 'Movies' : 'Series'})
      </button>

      {/* Category List */}
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {filteredCategories.map((category) => (
          <CategoryItem
            key={category.id}
            category={category}
            isSelected={selectedCategoryId === category.id}
            isExpanded={isCategoryExpanded(category.id)}
            onSelect={() => onCategorySelect(category.id)}
            onToggle={() => toggleCategory(category.id)}
          />
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">No categories found</p>
      )}
    </div>
  );
}

interface CategoryItemProps {
  category: Category;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

function CategoryItem({ category, isSelected, isExpanded, onSelect, onToggle }: CategoryItemProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      <button
        onClick={onToggle}
        className="p-1 hover:bg-gray-500/30 rounded transition-colors"
        title={isExpanded ? 'Collapse (H)' : 'Expand'}
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <button onClick={onSelect} className="flex-1 text-left truncate">
        {category.name}
      </button>
    </div>
  );
}
