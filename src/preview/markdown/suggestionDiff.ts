const linesOf = (text: string): string[] =>
  text === "" ? [] : text.split(/\r?\n/);

export const suggestionDiff = (source: string, replacement: string): string => {
  const before = linesOf(source);
  const after = linesOf(replacement);
  const width = after.length + 1;
  // Bound memory and work for large selections; a full replacement is still
  // a valid diff when finding individual unchanged lines would be expensive.
  if ((before.length + 1) * width > 1_000_000) {
    return [
      ...before.map((line) => `-${line}`),
      ...after.map((line) => `+${line}`),
    ].join("\n");
  }
  const lengths = new Uint32Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lengths[i * width + j] = before[i] === after[j]
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
  return diff.join("\n");
};
