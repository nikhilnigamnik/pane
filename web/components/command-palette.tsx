import { useCallback, useMemo } from 'react';

import { COPY } from '@/config/copy';
import type { Command } from '@/types/ui';
import { rankPaths } from '@/web/lib/fuzzy';
import type { FuzzyMatch } from '@/web/lib/fuzzy';
import { shortcutKeys } from '@/web/lib/shortcuts';

import { HighlightedText } from './ui/highlighted-text';
import { Kbd } from './ui/kbd';
import { Picker } from './ui/picker';

interface CommandPaletteProps {
  isOpen: boolean;
  commands: Command[];
  onClose: () => void;
}

interface CommandMatch {
  command: Command;
  match: FuzzyMatch;
}

export function CommandPalette({ isOpen, commands, onClose }: CommandPaletteProps) {
  const commandsByLabel = useMemo(
    () => new Map(commands.map((command) => [command.label, command])),
    [commands],
  );

  // Labels are ranked with the same fuzzy matcher quick open uses for paths.
  const filterItems = useCallback(
    (query: string): CommandMatch[] =>
      rankPaths([...commandsByLabel.keys()], query, commandsByLabel.size).flatMap((match) => {
        const command = commandsByLabel.get(match.path);
        return command ? [{ command, match }] : [];
      }),
    [commandsByLabel],
  );

  return (
    <Picker
      isOpen={isOpen}
      label={COPY.COMMAND_PALETTE}
      listLabel={COPY.COMMAND_PALETTE_RESULTS_LABEL}
      placeholder={COPY.COMMAND_PALETTE_PLACEHOLDER}
      filterItems={filterItems}
      itemKey={({ command }) => command.id}
      renderItem={({ command, match }) => (
        <>
          <span className="min-w-0 flex-1 truncate text-theme-text">
            <HighlightedText text={command.label} positions={match.positions} />
          </span>
          {command.shortcut && (
            <span className="flex shrink-0 items-center gap-1">
              {shortcutKeys(command.shortcut).map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          )}
        </>
      )}
      emptyMessage={COPY.COMMAND_PALETTE_EMPTY}
      onChoose={({ command }) => command.run()}
      onClose={onClose}
    />
  );
}
