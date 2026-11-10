import type { Paragraph, PhrasingContent } from "mdast";
import { suggestionDiff } from "./suggestionDiff";

// Keep inline Markdown nodes intact while comparing the text of prose.
// Removing positions also keeps old inline content out of current comment ranges.
const signature = (node: PhrasingContent): string =>
  JSON.stringify(node, (key, value) =>
    key === "position" ? undefined : value,
  );

const tokensOf = (paragraph: Paragraph): PhrasingContent[] =>
  paragraph.children.flatMap<PhrasingContent>((node) =>
    node.type === "text"
      ? Array.from(node.value, (value) => ({ type: "text", value }))
      : [JSON.parse(signature(node)) as PhrasingContent],
  );

const requiresSeparateRendering = (node: PhrasingContent): boolean =>
  node.type === "linkReference" ||
  node.type === "imageReference" ||
  node.type === "html" ||
  node.type === "footnoteReference" ||
  ("children" in node && node.children.some(requiresSeparateRendering));

const joinText = (nodes: PhrasingContent[]): PhrasingContent[] => {
  const result: PhrasingContent[] = [];
  for (const node of nodes) {
    const last = result.at(-1);
    if (last?.type === "text" && node.type === "text") last.value += node.value;
    else result.push({ ...node });
  }
  return result;
};

export const paragraphDiff = (
  previous: Paragraph,
  current: Paragraph,
): Paragraph | undefined => {
  // References depend on snapshot-specific definitions. Keep the existing
  // complete-block renderer for these so old and new links resolve separately.
  if (
    [...previous.children, ...current.children].some(requiresSeparateRendering)
  )
    return;
  const before = tokensOf(previous);
  const after = tokensOf(current);
  const diff = suggestionDiff(
    before.map(signature).join("\n"),
    after.map(signature).join("\n"),
  );
  const groups: { kind: string; children: PhrasingContent[] }[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let hasContext = false;
  for (const line of diff ? diff.split("\n") : []) {
    const kind = line[0];
    const node = kind === "-" ? before[oldIndex++] : after[newIndex++];
    if (kind === " ") {
      oldIndex++;
      hasContext ||= node.type !== "text" || node.value.trim() !== "";
    }
    const last = groups.at(-1);
    if (last && last.kind === kind) last.children.push(node);
    else groups.push({ kind, children: [node] });
  }
  if (!hasContext) return;
  return {
    ...current,
    children: groups.flatMap(({ kind, children }): PhrasingContent[] =>
      kind === " "
        ? joinText(children)
        : [
            {
              type: "emphasis",
              children: joinText(children),
              data: {
                hName:
                  kind === "-"
                    ? "revision-inline-deletion"
                    : "revision-inline-addition",
              },
            },
          ],
    ),
  };
};
