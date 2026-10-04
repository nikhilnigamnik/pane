import { ChevronRight } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';

import { COPY } from '@/config/copy';
import {
  ICON_SIZE_SMALL,
  ICON_STROKE_WIDTH,
  JSON_CHILDREN_PAGE_SIZE,
  JSON_DEFAULT_EXPAND_DEPTH,
  JSON_EXPAND_ALL_DEPTH,
} from '@/config/ui';
import { useModelText } from '@/web/hooks/use-model-text';
import { cn } from '@/web/lib/cn';
import { formatJsonPrimitive, jsonChildren, jsonKind, parseJson } from '@/web/lib/json-tree';
import type { JsonKind, JsonValue } from '@/web/lib/json-tree';

import { Button } from './ui/button';
import { Note } from './ui/note';
import { ScrollArea } from './ui/scroll-area';

interface JsonPreviewProps {
  path: string;
}

interface JsonNodeProps {
  // The object key or array index, or null for the top of the document.
  name: string | null;
  isIndex: boolean;
  value: JsonValue;
  depth: number;
  // Containers this deep or shallower start open.
  expandDepth: number;
}

// The same roles as in the editor theme: strings green, numbers and literals blue.
const VALUE_CLASSES: Record<JsonKind, string> = {
  object: 'text-theme-text-sec',
  array: 'text-theme-text-sec',
  string: 'text-theme-success',
  number: 'text-theme-blue',
  boolean: 'text-theme-blue',
  null: 'text-theme-blue',
};

const ROW_CLASSES = 'flex min-h-6 items-baseline gap-1.5 whitespace-pre-wrap break-all';

function JsonKey({ name, isIndex }: { name: string | null; isIndex: boolean }) {
  if (name === null) return null;
  return (
    <span className={cn('shrink-0', isIndex ? 'text-theme-text-tertiary' : 'text-theme-lavender')}>
      {isIndex ? name : JSON.stringify(name)}:
    </span>
  );
}

function JsonNode({ name, isIndex, value, depth, expandDepth }: JsonNodeProps) {
  const kind = jsonKind(value);
  const isContainer = kind === 'object' || kind === 'array';
  const [isExpanded, setIsExpanded] = useState(depth < expandDepth);
  const [shownCount, setShownCount] = useState(JSON_CHILDREN_PAGE_SIZE);

  if (!isContainer) {
    return (
      <div className={cn(ROW_CLASSES, 'pl-5')}>
        <JsonKey name={name} isIndex={isIndex} />
        <span className={VALUE_CLASSES[kind]}>{formatJsonPrimitive(value)}</span>
      </div>
    );
  }

  const children = jsonChildren(value);
  const summary = kind === 'array' ? COPY.JSON_ITEM_COUNT(children.length) : COPY.JSON_KEY_COUNT(children.length);
  const hiddenCount = children.length - shownCount;

  return (
    <div>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
        className={cn(ROW_CLASSES, 'w-full cursor-pointer rounded-xs text-left outline-none hover:bg-theme-fg-05 focus-visible:shadow-focus-ring')}
      >
        <ChevronRight
          size={ICON_SIZE_SMALL}
          strokeWidth={ICON_STROKE_WIDTH}
          className={cn('shrink-0 self-center text-theme-text-sec transition-transform', isExpanded && 'rotate-90')}
          aria-hidden
        />
        <JsonKey name={name} isIndex={isIndex} />
        <span className="text-theme-text-tertiary">
          {kind === 'array' ? '[ ]' : '{ }'} {summary}
        </span>
      </button>
      {isExpanded && (
        <div className="ml-2 border-l border-theme-border-01-5 pl-2">
          {children.slice(0, shownCount).map(([key, child]) => (
            <JsonNode
              key={key}
              name={key}
              isIndex={kind === 'array'}
              value={child}
              depth={depth + 1}
              expandDepth={expandDepth}
            />
          ))}
          {hiddenCount > 0 && (
            <Button
              variant="tertiary"
              size="tiny"
              onClick={() => setShownCount((current) => current + JSON_CHILDREN_PAGE_SIZE)}
              className="my-1 ml-5"
            >
              {COPY.JSON_SHOW_MORE(Math.min(hiddenCount, JSON_CHILDREN_PAGE_SIZE))}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Shows a JSON file as a tree that opens and closes, unsaved edits included.
export function JsonPreview({ path }: JsonPreviewProps) {
  // Parsing a large file on every keystroke would make typing lag, so it trails behind.
  const text = useDeferredValue(useModelText(path));
  const parsed = useMemo(() => parseJson(text), [text]);
  // Expand all and collapse all start the tree over at a new depth.
  const [expandDepth, setExpandDepth] = useState(JSON_DEFAULT_EXPAND_DEPTH);
  const [generation, setGeneration] = useState(0);

  function expandTo(depth: number) {
    setExpandDepth(depth);
    setGeneration((current) => current + 1);
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-theme-product-editor">
      <div className="flex shrink-0 items-center gap-1 border-b border-theme-border-02 bg-theme-product-chrome px-2 py-1.5">
        <Button variant="tertiary" size="tiny" disabled={!parsed.isValid} onClick={() => expandTo(JSON_EXPAND_ALL_DEPTH)}>
          {COPY.JSON_EXPAND_ALL}
        </Button>
        {/* The top level stays open, so collapsing still shows what the document holds. */}
        <Button variant="tertiary" size="tiny" disabled={!parsed.isValid} onClick={() => expandTo(1)}>
          {COPY.JSON_COLLAPSE_ALL}
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4 py-3 font-mono text-product-lg">
          {parsed.isValid ? (
            <JsonNode key={generation} name={null} isIndex={false} value={parsed.value} depth={0} expandDepth={expandDepth} />
          ) : (
            <Note variant="error">{COPY.JSON_INVALID(parsed.error)}</Note>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
