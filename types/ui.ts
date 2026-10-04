import type { Shortcut } from '@/config/shortcuts';

export type SidebarView = 'files' | 'search';

// An action listed in the command palette.
export interface Command {
  id: string;
  label: string;
  shortcut?: Shortcut;
  run: () => void;
}

// The two editor views: the tabs on the left and the side view on the right.
export type PaneId = 'main' | 'side';
