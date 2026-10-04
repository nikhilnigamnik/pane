import { COPY } from '@/config/copy';
import { SHORTCUTS } from '@/config/shortcuts';
import { shortcutKeys } from '@/web/lib/shortcuts';

import { Kbd } from './ui/kbd';

const SHORTCUT_HINTS = [
  { shortcut: SHORTCUTS.QUICK_OPEN, hint: COPY.SHORTCUT_HINT_QUICK_OPEN },
  { shortcut: SHORTCUTS.SEARCH, hint: COPY.SHORTCUT_HINT_SEARCH },
  { shortcut: SHORTCUTS.SAVE, hint: COPY.SHORTCUT_HINT_SAVE },
];

export function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-theme-product-editor px-6 text-center">
      <h1 className="text-base text-theme-text">{COPY.EMPTY_STATE_TITLE}</h1>
      <p className="text-sm text-theme-text-sec">{COPY.EMPTY_STATE_HINT}</p>
      {/* Two columns keep the keys right-aligned against their descriptions. */}
      <dl className="mt-3 grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-2 text-product-lg text-theme-text-sec">
        {SHORTCUT_HINTS.map(({ shortcut, hint }) => (
          <div key={hint} className="contents">
            <dt className="flex items-center justify-end gap-1">
              {shortcutKeys(shortcut).map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dt>
            <dd className="text-left">{hint}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
