const linesOf = (text: string): string[] =>
  text === "" ? [] : text.split(/\r?\n/);

// Large documents often have only a few edits far apart. Search by edit
// distance before falling back to replacement, without allocating an N × M table.
const sparseDiff = (
  before: string[],
  after: string[],
): string[] | undefined => {
  const limit = Math.min(before.length + after.length, 1_000);
  const offset = limit + 1;
  const frontier = new Int32Array(2 * limit + 3);
  const history: Int32Array[] = [];
  let work = 0;
  for (let distance = 0; distance <= limit; distance += 1) {
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      if (++work > 1_000_000) return undefined;
      const index = offset + diagonal;
      let x =
        diagonal === -distance ||
        (diagonal !== distance && frontier[index - 1] < frontier[index + 1])
          ? frontier[index + 1]
          : frontier[index - 1] + 1;
      let y = x - diagonal;
      while (x < before.length && y < after.length && before[x] === after[y]) {
        if (++work > 1_000_000) return undefined;
        x += 1;
        y += 1;
      }
      frontier[index] = x;
      if (x === before.length && y === after.length) {
        const diff: string[] = [];
        for (let step = distance; step > 0; step -= 1) {
          const previous = history[step - 1];
          const diagonal = x - y;
          const index = diagonal + step - 1;
          const previousDiagonal =
            diagonal === -step ||
            (diagonal !== step && previous[index - 1] < previous[index + 1])
              ? diagonal + 1
              : diagonal - 1;
          const previousX = previous[previousDiagonal + step - 1];
          const previousY = previousX - previousDiagonal;
          while (x > previousX && y > previousY) {
            diff.push(` ${before[--x]}`);
            y -= 1;
          }
          if (x === previousX) diff.push(`+${after[--y]}`);
          else diff.push(`-${before[--x]}`);
        }
        while (x > 0 && y > 0) {
          diff.push(` ${before[--x]}`);
          y -= 1;
        }
        return diff.reverse();
      }
    }
    history.push(frontier.slice(offset - distance, offset + distance + 1));
  }
  return undefined;
};

const diffLines = (before: string[], after: string[]): string[] => {
  const width = after.length + 1;
  // Bound memory and work for both dense and sparse changes.
  if ((before.length + 1) * width > 1_000_000) {
    return (
      sparseDiff(before, after) ?? [
        ...before.map((line) => `-${line}`),
        ...after.map((line) => `+${line}`),
      ]
    );
  }
  const lengths = new Uint32Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lengths[i * width + j] =
        before[i] === after[j]
          ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }

  const diff: string[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      diff.push(` ${before[i]}`);
      i += 1;
      j += 1;
    } else if (
      i < before.length &&
      (j === after.length ||
        lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])
    ) {
      diff.push(`-${before[i]}`);
      i += 1;
    } else {
      diff.push(`+${after[j]}`);
      j += 1;
    }
  }
  return diff;
};

export const suggestionDiff = (source: string, replacement: string): string => {
  const before = linesOf(source);
  const after = linesOf(replacement);
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start += 1;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - end - 1] === after[after.length - end - 1]
  )
    end += 1;
  return [
    ...before.slice(0, start).map((line) => ` ${line}`),
    ...diffLines(
      before.slice(start, before.length - end),
      after.slice(start, after.length - end),
    ),
    ...before.slice(before.length - end).map((line) => ` ${line}`),
  ].join("\n");
};
