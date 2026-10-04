export interface MarkdownHeading {
  // 1 for "#", up to 6 for "######".
  level: number;
  text: string;
  // Counts from 1, like editor lines.
  line: number;
}

// An ATX heading: up to three spaces, one to six "#", then the text and optional closing "#"s.
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
// The opening of a fenced code block: three or more backticks or tildes.
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LINE_BREAK = /\r?\n/;

// Lists the "#" headings of a Markdown document in order. Lines inside fenced code blocks are
// code, not headings, so they are skipped. Underlined (setext) headings are not recognized.
export function markdownHeadings(text: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  let openFence: string | null = null;

  text.split(LINE_BREAK).forEach((line, index) => {
    const fence = CODE_FENCE.exec(line)?.[1];
    if (fence) {
      // A block closes with a fence of the same character that is at least as long.
      const isClosing = openFence !== null && fence[0] === openFence[0] && fence.length >= openFence.length;
      if (openFence === null) openFence = fence;
      else if (isClosing) openFence = null;
      return;
    }
    if (openFence !== null) return;

    const match = ATX_HEADING.exec(line);
    if (!match?.[1]) return;
    const headingText = (match[2] ?? '').trim();
    if (headingText) headings.push({ level: match[1].length, text: headingText, line: index + 1 });
  });

  return headings;
}
