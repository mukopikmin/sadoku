export type FrontMatterItem = {
  endLine: number;
  key: string;
  startLine: number;
  value: string;
};

export type ExtractedFrontMatter = {
  bodyMarkdown: string;
  endLine: number;
  items: FrontMatterItem[];
};

const supportedAgentFileNames = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "SKILL.md",
  "copilot-instructions.md",
]);

export const isAgentInstructionDocument = (documentPath?: string): boolean => {
  if (!documentPath) return false;
  const pathWithoutQuery = documentPath.split(/[?#]/, 1)[0];
  const fileName = pathWithoutQuery.split(/[\\/]/).at(-1);
  return fileName !== undefined && supportedAgentFileNames.has(fileName);
};

const unquote = (value: string): string => {
  if (value.length < 2) return value;
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.at(-1) !== quote) return value;
  if (quote === "'") return value.slice(1, -1).replaceAll("''", "'");
  try {
    return JSON.parse(value) as string;
  } catch {
    return value;
  }
};

const parseItems = (lines: string[], closingIndex: number) => {
  const items: FrontMatterItem[] = [];
  let index = 1;
  while (index < closingIndex) {
    if (
      lines[index].trim() === "" || lines[index].trimStart().startsWith("#")
    ) {
      index++;
      continue;
    }
    const match = /^([A-Za-z_][\w.-]*):(?:[ \t]*(.*))?$/.exec(lines[index]);
    if (!match) return undefined;
    const [, key, rawValue = ""] = match;
    const startLine = index + 1;

    if (rawValue === "|" || rawValue === ">") {
      const continuation: string[] = [];
      index++;
      while (index < closingIndex && /^(?:[ \t]+|$)/.test(lines[index])) {
        continuation.push(lines[index].replace(/^[ \t]{1,2}/, ""));
        index++;
      }
      const value = rawValue === ">"
        ? continuation.join(" ").replace(/\s+/g, " ").trim()
        : continuation.join("\n").replace(/\n+$/, "");
      items.push({ endLine: index, key, startLine, value });
      continue;
    }

    items.push({
      endLine: startLine,
      key,
      startLine,
      value: unquote(rawValue),
    });
    index++;
  }
  return items;
};

export const extractAgentFrontMatter = (
  markdown: string,
  documentPath?: string,
): ExtractedFrontMatter | undefined => {
  if (!isAgentInstructionDocument(documentPath)) return undefined;
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== "---") return undefined;
  const closingIndex = lines.findIndex((line, index) =>
    index > 0 && line === "---"
  );
  if (closingIndex < 0) return undefined;
  const items = parseItems(lines, closingIndex);
  if (!items || items.length === 0) return undefined;
  const endLine = closingIndex + 1;
  return {
    bodyMarkdown: "\n".repeat(endLine) + lines.slice(endLine).join("\n"),
    endLine,
    items,
  };
};
