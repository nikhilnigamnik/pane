import * as monaco from 'monaco-editor';
import { useEffect, useState } from 'react';

import { MARKDOWN_CODE_TAB_SIZE } from '@/config/ui';

interface MarkdownCodeBlockProps {
  code: string;
  // The name written after the opening fence ("ts", "bash"), if any.
  language: string | null;
}

// Monaco draws spaces as non-breaking spaces. Left in, they would end up in whatever the
// reader copies out of the block.
const NON_BREAKING_SPACE = / |&#160;|&nbsp;/g;

// Markdown names languages loosely ("ts", "sh", "yml"), so the name is tried as a Monaco
// language id first and then as an alias or a file extension.
function findLanguageId(name: string): string | null {
  const wanted = name.toLowerCase();
  const languages = monaco.languages.getLanguages();
  const language =
    languages.find(({ id }) => id === wanted) ??
    languages.find(
      ({ aliases, extensions }) =>
        aliases?.some((alias) => alias.toLowerCase() === wanted) ||
        extensions?.includes(`.${wanted}`),
    );
  return language?.id ?? null;
}

// A fenced code block, colored with the editor's own tokenizer and theme so code looks the
// same in the preview as it does in a tab.
export function MarkdownCodeBlock({ code, language }: MarkdownCodeBlockProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function highlight() {
      const languageId = language ? findLanguageId(language) : null;
      if (!languageId) {
        setHighlighted(null);
        return;
      }
      const html = await monaco.editor.colorize(code, languageId, {
        tabSize: MARKDOWN_CODE_TAB_SIZE,
      });
      if (!isCancelled) setHighlighted(html.replace(NON_BREAKING_SPACE, ' '));
    }

    void highlight();
    return () => {
      isCancelled = true;
    };
  }, [code, language]);

  return (
    <pre className="my-4 overflow-x-auto rounded-md border border-theme-border-02 bg-theme-bg p-3 font-mono text-product-lg leading-5 text-theme-text">
      {highlighted === null ? (
        <code>{code}</code>
      ) : (
        // Monaco escapes the code itself. The markup it returns is only its own token spans.
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      )}
    </pre>
  );
}
