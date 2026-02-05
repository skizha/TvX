import { useEffect, useCallback } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface KeyBindings {
  [key: string]: KeyHandler;
}

/**
 * Hook for keyboard shortcuts
 * @param bindings Object mapping key combinations to handlers
 * @param enabled Whether the shortcuts are active
 */
export function useKeyboard(bindings: KeyBindings, enabled: boolean = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Build key string (e.g., "ctrl+h", "shift+enter")
      const parts: string[] = [];
      if (event.ctrlKey || event.metaKey) parts.push('ctrl');
      if (event.altKey) parts.push('alt');
      if (event.shiftKey) parts.push('shift');
      parts.push(event.key.toLowerCase());

      const keyString = parts.join('+');

      // Check for exact match
      if (bindings[keyString]) {
        event.preventDefault();
        bindings[keyString](event);
        return;
      }

      // Check for key without modifiers
      if (!event.ctrlKey && !event.altKey && !event.shiftKey && bindings[event.key.toLowerCase()]) {
        // Don't trigger if typing in an input
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        event.preventDefault();
        bindings[event.key.toLowerCase()](event);
      }
    },
    [bindings, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
