interface HighlightedTextProps {
  text: string;
  // Indexes of the characters to highlight.
  positions: readonly number[];
}

interface Run {
  text: string;
  isMatch: boolean;
}

// Groups neighbouring characters, so a matched stretch is one element instead of one per letter.
function toRuns(text: string, positions: readonly number[]): Run[] {
  const matched = new Set(positions);
  const runs: Run[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const isMatch = matched.has(index);
    const last = runs.at(-1);
    if (last?.isMatch === isMatch) last.text += text.charAt(index);
    else runs.push({ text: text.charAt(index), isMatch });
  }
  return runs;
}

export function HighlightedText({ text, positions }: HighlightedTextProps) {
  if (positions.length === 0) return text;

  return toRuns(text, positions).map((run, index) =>
    run.isMatch ? (
      <mark key={index} className="bg-transparent text-theme-accent">
        {run.text}
      </mark>
    ) : (
      <span key={index}>{run.text}</span>
    ),
  );
}
