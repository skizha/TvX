import { useAppStore, useSettingsStore } from '../store';
import type { ContentType, CustomGroup } from '../types';

interface AddToGroupMenuProps {
  contentId: number;
  contentType: ContentType;
  onClose: () => void;
}

export function AddToGroupMenu({ contentId, contentType, onClose }: AddToGroupMenuProps) {
  const { currentServer } = useAppStore();
  const { customGroups, addContentToGroup, removeContentFromGroup } = useSettingsStore();

  const serverId = currentServer?.id || '';
  const serverGroups = customGroups[serverId] || [];

  // Only show custom groups that match the current content type (Live/Movies/Series)
  const matchingGroups = serverGroups.filter((g) => g.type === contentType);

  const contentIdNum = Number(contentId);
  const handleToggleGroup = (group: CustomGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const isInGroup = group.contentIds.some((id) => Number(id) === contentIdNum);
    if (isInGroup) {
      removeContentFromGroup(serverId, group.id, contentIdNum);
    } else {
      addContentToGroup(serverId, group.id, contentIdNum);
    }
  };

  if (matchingGroups.length === 0) {
    return (
      <div className="px-4 py-2.5 text-sm text-gray-500 italic">
        No custom groups for this type. Create one in Settings.
      </div>
    );
  }

  return (
    <>
      {matchingGroups.map((group) => {
        const isInGroup = group.contentIds.some((id) => Number(id) === contentIdNum);
        return (
          <button
            key={group.id}
            type="button"
            onClick={(e) => {
              handleToggleGroup(group, e);
              onClose();
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
          >
            {isInGroup ? (
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            <span className="flex-1">{group.name}</span>
          </button>
        );
      })}
    </>
  );
}
