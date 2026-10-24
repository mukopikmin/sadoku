import { suggestionDiff } from "./suggestionDiff";

/** Source line numbers are one-based, matching Markdown node positions. */
export const changedRevisionLines = (previous: string, current: string) => {
  const previousLines = new Set<number>();
  const currentLines = new Set<number>();
  let before = 1;
  let after = 1;
  for (const line of suggestionDiff(previous, current).split("\n")) {
    if (line.startsWith("-")) previousLines.add(before++);
    else if (line.startsWith("+")) currentLines.add(after++);
    else {
      before += 1;
      after += 1;
    }
  }
  return { previous: previousLines, current: currentLines };
};

export const containsChangedLine = (
  lines: ReadonlySet<number>,
  start: number,
  end: number,
): boolean => {
  for (let line = start; line <= end; line += 1) {
    if (lines.has(line)) return true;
  }
  return false;
};
