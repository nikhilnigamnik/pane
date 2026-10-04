import { describe, expect, it, vi } from 'vitest';

import { SHORTCUTS } from '@/config/shortcuts';

import { buildCommands } from './command-list';
import type { CommandActions, CommandContext } from './command-list';

const ACTIONS = new Proxy({} as CommandActions, {
  get: () => vi.fn(),
});

function ids(context: Partial<CommandContext>): string[] {
  const full: CommandContext = {
    hasTextFile: false,
    hasFile: false,
    canPreview: false,
    hasSideView: false,
    hasConflict: false,
    actions: ACTIONS,
    ...context,
  };
  return buildCommands(full).map((command) => command.id);
}

describe('buildCommands', () => {
  it('offers only what works with nothing open', () => {
    expect(ids({})).toEqual([
      'quick-open',
      'search',
      'show-files',
      'new-file',
      'new-folder',
      'refresh-files',
    ]);
  });

  it('adds file commands once a text file is open', () => {
    const open = ids({ hasTextFile: true, hasFile: true });
    expect(open).toEqual(expect.arrayContaining(['save', 'go-to-line', 'rename-file', 'close-tab']));
    expect(open).not.toContain('toggle-preview');
    expect(open).not.toContain('close-side-view');
  });

  it('leaves out text commands for a picture', () => {
    const picture = ids({ hasFile: true });
    expect(picture).toContain('open-to-side');
    expect(picture).not.toContain('save');
    expect(picture).not.toContain('go-to-symbol');
  });

  it('adds commands that depend on the situation', () => {
    const all = ids({ hasTextFile: true, hasFile: true, canPreview: true, hasSideView: true, hasConflict: true });
    expect(all).toEqual(expect.arrayContaining(['toggle-preview', 'close-side-view', 'reload-from-disk']));
  });

  it('shows each shortcut and runs the matching action', () => {
    const run = vi.fn();
    const [quickOpen] = buildCommands({
      hasTextFile: false,
      hasFile: false,
      canPreview: false,
      hasSideView: false,
      hasConflict: false,
      actions: { ...ACTIONS, quickOpen: run },
    });

    expect(quickOpen?.shortcut).toBe(SHORTCUTS.QUICK_OPEN);
    quickOpen?.run();
    expect(run).toHaveBeenCalledOnce();
  });

  it('gives every command a unique id', () => {
    const all = ids({ hasTextFile: true, hasFile: true, canPreview: true, hasSideView: true, hasConflict: true });
    expect(new Set(all).size).toBe(all.length);
  });
});
