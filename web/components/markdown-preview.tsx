import { createContext, useContext, useMemo } from 'react';
import type { CSSProperties, ComponentProps, MouseEvent } from 'react';
import Markdown from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useModelText } from '@/web/hooks/use-model-text';
import { rawFileUrl } from '@/web/lib/api';
import { cn } from '@/web/lib/cn';
import { resolveRelativePath } from '@/web/lib/path';

import { MarkdownCodeBlock } from './markdown-code-block';
import { ScrollArea } from './ui/scroll-area';

interface MarkdownPreviewProps {
  path: string;
  onOpenFile: (path: string) => void;
}

interface MarkdownContextValue {
  // The Markdown file on screen. Relative links and images are resolved against it.
  path: string;
  onOpenFile: (path: string) => void;
}

type HastElement = NonNullable<ExtraProps['node']>;

const MarkdownContext = createContext<MarkdownContextValue>({
  path: '',
  onOpenFile: () => undefined,
});

const REMARK_PLUGINS = [remarkGfm];

// Starts with a scheme ("https:", "mailto:"), so it points outside the opened folder.
const EXTERNAL_URL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const LANGUAGE_CLASS_PREFIX = 'language-';
const TASK_LIST_CLASS = 'contains-task-list';
// A fenced block ends with a line break that is not part of the code.
const FINAL_LINE_BREAK = /\n$/;

const LINK_CLASSES =
  'text-theme-text underline decoration-theme-border-03 underline-offset-2 transition-colors hover:decoration-theme-text';
const HEADING_CLASSES = 'font-medium text-theme-text first:mt-0';
const CELL_CLASSES = 'border border-theme-border-02 px-3 py-1.5';

const ALIGN_CLASSES: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

// Column alignment arrives as an inline style. It is turned into a class to keep all styling
// in Tailwind.
function alignClass(style: CSSProperties | undefined): string | undefined {
  return style?.textAlign ? ALIGN_CLASSES[style.textAlign] : undefined;
}

function hastText(node: HastElement): string {
  return node.children
    .map((child) => {
      if (child.type === 'text') return child.value;
      return child.type === 'element' ? hastText(child) : '';
    })
    .join('');
}

function codeLanguage(code: HastElement): string | null {
  const { className } = code.properties;
  if (!Array.isArray(className)) return null;
  const languageClass = className.find(
    (name): name is string => typeof name === 'string' && name.startsWith(LANGUAGE_CLASS_PREFIX),
  );
  return languageClass?.slice(LANGUAGE_CLASS_PREFIX.length) ?? null;
}

function MarkdownLink({ href, children }: ComponentProps<'a'>) {
  const { path, onOpenFile } = useContext(MarkdownContext);

  if (href && EXTERNAL_URL_PATTERN.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={LINK_CLASSES}>
        {children}
      </a>
    );
  }

  // A relative link names a file in the opened folder. It opens in a tab; following it as a
  // normal link would navigate away from the app.
  function handleClick(event: MouseEvent) {
    event.preventDefault();
    const target = href ? resolveRelativePath(path, href) : null;
    if (target) onOpenFile(target);
  }

  return (
    <a href={href} onClick={handleClick} className={LINK_CLASSES}>
      {children}
    </a>
  );
}

function MarkdownImage({ src, alt }: ComponentProps<'img'>) {
  const { path } = useContext(MarkdownContext);
  if (typeof src !== 'string') return null;

  const target = resolveRelativePath(path, src);
  const source = EXTERNAL_URL_PATTERN.test(src) ? src : target && rawFileUrl(target);
  // A path that leads out of the opened folder has nothing to show but its description.
  if (!source) return alt ?? null;
  return <img src={source} alt={alt ?? ''} className="inline-block max-w-full" />;
}

function MarkdownPre({ node, children }: ComponentProps<'pre'> & ExtraProps) {
  const code = node?.children.find(
    (child): child is HastElement => child.type === 'element' && child.tagName === 'code',
  );
  if (!code) return <pre className="my-4 overflow-x-auto font-mono">{children}</pre>;

  return (
    <MarkdownCodeBlock
      code={hastText(code).replace(FINAL_LINE_BREAK, '')}
      language={codeLanguage(code)}
    />
  );
}

const MARKDOWN_COMPONENTS: Components = {
  a: MarkdownLink,
  img: MarkdownImage,
  pre: MarkdownPre,
  h1: ({ children }) => (
    <h1 className={cn(HEADING_CLASSES, 'mt-10 mb-4 border-b border-theme-border-02 pb-2 text-md-lg')}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className={cn(HEADING_CLASSES, 'mt-10 mb-3 border-b border-theme-border-02 pb-2 text-md')}>
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className={cn(HEADING_CLASSES, 'mt-8 mb-2 text-md-sm')}>{children}</h3>,
  h4: ({ children }) => <h4 className={cn(HEADING_CLASSES, 'mt-6 mb-2 text-base')}>{children}</h4>,
  h5: ({ children }) => <h5 className={cn(HEADING_CLASSES, 'mt-6 mb-2 text-sm')}>{children}</h5>,
  h6: ({ children }) => (
    <h6 className={cn(HEADING_CLASSES, 'mt-6 mb-2 text-sm text-theme-text-sec')}>{children}</h6>
  ),
  p: ({ children }) => <p className="my-3">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-theme-text">{children}</strong>,
  ul: ({ className, children }) => (
    <ul className={cn('my-3', className?.includes(TASK_LIST_CLASS) ? 'pl-1' : 'list-disc pl-6')}>
      {children}
    </ul>
  ),
  ol: ({ start, children }) => (
    <ol start={start} className="my-3 list-decimal pl-6">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="my-1">{children}</li>,
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={checked ?? false}
      disabled
      readOnly
      className="mr-2 align-middle accent-theme-fg"
    />
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-theme-border-03 pl-4 text-theme-text-sec">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-xs bg-theme-fg-08 px-1 py-0.5 font-mono text-product-lg">{children}</code>
  ),
  hr: () => <hr className="my-8 border-theme-border-02" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ style, children }) => (
    <th className={cn(CELL_CLASSES, 'bg-theme-fg-05 font-medium', alignClass(style))}>{children}</th>
  ),
  td: ({ style, children }) => <td className={cn(CELL_CLASSES, alignClass(style))}>{children}</td>,
};

// Renders the Markdown that is in the editor right now, unsaved edits included. Raw HTML in
// the file is shown as text, never run, because the file is not trusted content.
export function MarkdownPreview({ path, onOpenFile }: MarkdownPreviewProps) {
  const text = useModelText(path);
  const context = useMemo(() => ({ path, onOpenFile }), [path, onOpenFile]);

  return (
    <ScrollArea className="absolute inset-0 bg-theme-product-editor">
      <article className="mx-auto max-w-3xl px-8 py-8 text-sm text-theme-fg-02">
        <MarkdownContext.Provider value={context}>
          <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
            {text}
          </Markdown>
        </MarkdownContext.Provider>
      </article>
    </ScrollArea>
  );
}
