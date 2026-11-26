import type { Blockquote, Parent, PhrasingContent, Root } from "mdast";
import { decodeString } from "micromark-util-decode-string";
import type { Plugin } from "unified";

// A character reference can decode to a newline on the same source line.
const splitTextLines = (value: string, source: string): string[] => {
  if (
    !source.includes("&") ||
    value.match(/[\r\n]/g)?.length === source.match(/[\r\n]/g)?.length
  ) {
    return value.split(/\r\n|\r|\n/);
  }
  const breaks = value.matchAll(/[\r\n]/g);
  const lines: string[] = [];
  let start = 0;
  for (const [, rawLine, ending] of source.matchAll(
    /^([^\r\n]*)(\r\n|\r|\n)/gm,
  )) {
    for (const _ of decodeString(rawLine).matchAll(/[\r\n]/g)) breaks.next();
    const end = breaks.next().value?.index ?? value.length;
    lines.push(value.slice(start, end));
    if (ending === "\r\n") breaks.next();
    start = end + ending.length;
  }
  lines.push(value.slice(start));
  return lines;
};

// Split already-parsed inline content so formatting and reference links can
// continue across source lines without parsing each line as separate Markdown.
const inlineLines = (
  children: PhrasingContent[],
  firstLine: number,
  source: string,
) => {
  const lines = new Map<number, PhrasingContent[]>();
  const append = (line: number, child: PhrasingContent) => {
    const existing = lines.get(line);
    if (existing) existing.push(child);
    else lines.set(line, [child]);
  };
  for (const node of children) {
    const line = node.position?.start.line ?? firstLine;
    if (node.type === "break") continue;
    if (!node.position || line === node.position.end.line) {
      append(line, node);
    } else if ("children" in node) {
      for (const [innerLine, children] of inlineLines(
        node.children,
        line,
        source,
      )) {
        append(innerLine, { ...node, children });
      }
    } else if (node.type === "text" || node.type === "inlineCode") {
      const raw = source.slice(
        node.position.start.offset,
        node.position.end.offset,
      );
      const parts =
        node.type === "text"
          ? splitTextLines(node.value, raw)
          : node.value.split(/\r\n|\r|\n/);
      // CommonMark can trim one leading line ending inside a code span.
      const trimmedOpening =
        node.type === "inlineCode" &&
        /^`+(?:\r\n|\r|\n)/.test(raw) &&
        parts.length <= node.position.end.line - line;
      const start = trimmedOpening ? line + 1 : line;
      parts.forEach((value, index) =>
        append(start + index, { ...node, value }),
      );
    } else {
      append(line, node);
    }
  }
  return lines;
};

export const remarkQuoteLines: Plugin<[], Root> = () => (tree, file) => {
  const source = String(file);
  let sourceLines: string[] | undefined;
  const splitQuote = (quote: Blockquote) => {
    const position = quote.position;
    if (!position || position.start.line === position.end.line) return;
    const rawLines = (sourceLines ??= source.split(/\r\n|\r|\n/));
    const rows: Blockquote["children"] = [];
    let line = position.start.line;
    const addLine = (children: PhrasingContent[] = []) => {
      rows.push({
        type: "paragraph",
        children: children.length ? children : [{ type: "break" }],
        position: {
          start: { line, column: 1 },
          end: { line, column: rawLines[line - 1].length + 1 },
        },
      });
      line++;
    };
    for (const child of quote.children) {
      const range = child.position;
      if (range) {
        while (line < range.start.line) addLine();
      }
      if (
        child.type === "paragraph" &&
        range &&
        range.end.line > range.start.line
      ) {
        const lines = inlineLines(child.children, range.start.line, source);
        while (line <= range.end.line) addLine(lines.get(line));
      } else {
        rows.push(child);
        if (range) line = range.end.line + 1;
      }
    }
    while (line <= position.end.line) addLine();
    quote.children = rows;
    quote.data = { ...quote.data, hName: "review-quote" };
  };

  const visit = (parent: Parent) => {
    for (const child of parent.children) {
      if (child.type === "blockquote" && !child.data?.hName) {
        if (child.data?.hProperties?.["data-markdown-alert"]) continue;
        splitQuote(child);
      }
      if ("children" in child) visit(child);
    }
  };
  visit(tree);
};
