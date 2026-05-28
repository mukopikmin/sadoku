export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string | undefined; code: string }
  | { type: "mermaid"; language: string | undefined; code: string }
  | { type: "blockquote"; blocks: MarkdownBlock[] }
  | {
    type: "table";
    headers: string[];
    alignments: Array<"left" | "center" | "right" | undefined>;
    rows: string[][];
  }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "hr" };

const isBlank = (line: string): boolean => line.trim() === "";

const splitTableRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
};

const parseTableDivider = (
  line: string,
): Array<"left" | "center" | "right" | undefined> | undefined => {
  const cells = splitTableRow(line);
  if (cells.length === 0) return undefined;

  const alignments: Array<"left" | "center" | "right" | undefined> = [];
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/.test(cell)) return undefined;
    if (cell.startsWith(":") && cell.endsWith(":")) {
      alignments.push("center");
    } else if (cell.endsWith(":")) {
      alignments.push("right");
    } else if (cell.startsWith(":")) {
      alignments.push("left");
    } else {
      alignments.push(undefined);
    }
  }

  return alignments;
};

const isTableStart = (lines: string[], index: number): boolean => {
  if (index + 1 >= lines.length || !lines[index].includes("|")) return false;
  const headers = splitTableRow(lines[index]);
  const alignments = parseTableDivider(lines[index + 1]);
  return Boolean(alignments && headers.length === alignments.length);
};

const isBlockStart = (lines: string[], index: number): boolean => {
  const line = lines[index];
  return (
    isBlank(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^`{3,}[A-Za-z0-9_-]*\s*$/.test(line.trim()) ||
    /^>\s?/.test(line) ||
    isTableStart(lines, index) ||
    /^-{3,}\s*$/.test(line.trim()) ||
    /^(\s*)([-*+])\s+/.test(line) ||
    /^(\s*)\d+[.)]\s+/.test(line)
  );
};

const collectParagraph = (
  lines: string[],
  start: number,
): [MarkdownBlock, number] => {
  const paragraph: string[] = [];
  let index = start;

  while (index < lines.length && !isBlockStart(lines, index)) {
    paragraph.push(lines[index].trim());
    index += 1;
  }

  return [{ type: "paragraph", text: paragraph.join(" ") }, index];
};

const collectList = (
  lines: string[],
  start: number,
  ordered: boolean,
): [MarkdownBlock, number] => {
  const items: string[] = [];
  let index = start;
  const pattern = ordered ? /^(\s*)\d+[.)]\s+(.*)$/ : /^(\s*)[-*+]\s+(.*)$/;

  while (index < lines.length) {
    const match = lines[index].match(pattern);
    if (!match) break;
    items.push(match[2].trim());
    index += 1;
  }

  return [{ type: "list", ordered, items }, index];
};

const collectTable = (
  lines: string[],
  start: number,
): [MarkdownBlock, number] => {
  const headers = splitTableRow(lines[start]);
  const alignments = parseTableDivider(lines[start + 1]);
  if (!alignments) {
    return [{ type: "paragraph", text: lines[start].trim() }, start + 1];
  }

  const rows: string[][] = [];
  let index = start + 2;

  while (
    index < lines.length && lines[index].includes("|") && !isBlank(lines[index])
  ) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  return [{ type: "table", headers, alignments, rows }, index];
};

export const parseMarkdown = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (isBlank(line)) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^(`{3,})([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !(/^`+\s*$/.test(lines[index].trim()) &&
          lines[index].trim().length >= fence[1].length)
      ) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;

      const language = fence[2];
      blocks.push({
        type: language?.toLowerCase() === "mermaid" ? "mermaid" : "code",
        language,
        code: code.join("\n"),
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^-{3,}\s*$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({
        type: "blockquote",
        blocks: parseMarkdown(quote.join("\n")),
      });
      continue;
    }

    if (isTableStart(lines, index)) {
      const [block, nextIndex] = collectTable(lines, index);
      blocks.push(block);
      index = nextIndex;
      continue;
    }

    if (/^(\s*)[-*+]\s+/.test(line)) {
      const [block, nextIndex] = collectList(lines, index, false);
      blocks.push(block);
      index = nextIndex;
      continue;
    }

    if (/^(\s*)\d+[.)]\s+/.test(line)) {
      const [block, nextIndex] = collectList(lines, index, true);
      blocks.push(block);
      index = nextIndex;
      continue;
    }

    const [block, nextIndex] = collectParagraph(lines, index);
    blocks.push(block);
    index = nextIndex;
  }

  return blocks;
};
