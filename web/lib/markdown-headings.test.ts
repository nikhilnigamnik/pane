import { describe, expect, it } from 'vitest';

import { markdownHeadings } from './markdown-headings';

describe('markdownHeadings', () => {
  it('lists headings with their level and line', () => {
    const text = '# Title\n\nIntro\n\n## Install ##\r\n### Step  one\n';
    expect(markdownHeadings(text)).toEqual([
      { level: 1, text: 'Title', line: 1 },
      { level: 2, text: 'Install', line: 5 },
      { level: 3, text: 'Step  one', line: 6 },
    ]);
  });

  it('ignores lines that only look like headings', () => {
    expect(markdownHeadings('#hashtag\n####### seven\n    # indented code\n#\n')).toEqual([]);
  });

  it('skips headings inside fenced code blocks', () => {
    const text = '```sh\n# comment\n```\n~~~~\n# also code\n~~~\n# still code\n~~~~\n## Real\n';
    expect(markdownHeadings(text)).toEqual([{ level: 2, text: 'Real', line: 9 }]);
  });
});
