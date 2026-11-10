import type { Blockquote, List, Root, RootContent } from "mdast";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { unified } from "unified";
import { suggestionDiff } from "./suggestionDiff";
import { paragraphDiff } from "./paragraphDiff";

const parser = unified().use(remarkParse).use(remarkGfm);

const sourceOf = (node: RootContent, source: string) =>
  source.slice(node.position?.start.offset, node.position?.end.offset);

// Compare complete Markdown blocks so tables and fenced code stay valid.
// Lists are compared by item, then adjacent items are joined back into lists.
// Keep old and current positions separate so comments use the correct source.
export const remarkDocumentDiff =
  ({ previous, current }: { previous: string; current: string }) =>
  (tree: Root) => {
    const before = parser.parse(previous) as Root;
    const previousDefinitions = before.children.filter(
      (node) => node.type === "definition",
    );
    const currentDefinitions = tree.children.filter(
      (node) => node.type === "definition",
    );
    const listOrigins = new Map<RootContent, List>();
    const blocksOf = (root: Root): RootContent[] =>
      root.children.flatMap<RootContent>((node) => {
        if (node.type === "definition") return [];
        if (node.type !== "list") return [node];
        return node.children.map((item, index): List => {
          const fragment: List = {
            ...node,
            start: node.ordered ? (node.start ?? 1) + index : node.start,
            children: [item],
            position: item.position,
          };
          listOrigins.set(fragment, node);
          return fragment;
        });
      });
    const oldBlocks = blocksOf(before);
    const newBlocks = blocksOf(tree);
    const signatures = (
      blocks: RootContent[],
      definitions: RootContent[],
      source: string,
    ) => {
      const references = new Map(
        definitions.flatMap((node) =>
          node.type === "definition"
            ? [[node.identifier, sourceOf(node, source)]]
            : [],
        ),
      );
      return blocks
        .map((node) => {
          const dependencies: string[] = [];
          const visit = (child: RootContent | Root) => {
            if (
              child.type === "linkReference" ||
              child.type === "imageReference"
            ) {
              dependencies.push(references.get(child.identifier) ?? "");
            }
            if ("children" in child) child.children.forEach(visit);
          };
          visit(node);
          const sourceText = sourceOf(node, source).replaceAll("\r\n", "\n");
          return JSON.stringify([
            // Renumbering an ordered list after an insertion does not change
            // the following items' content.
            node.type === "list"
              ? [
                  node.ordered,
                  listOrigins.get(node)?.start,
                  sourceText.replace(/^\d+[.)](?=\s)/, "1."),
                ]
              : sourceText,
            dependencies,
          ]);
        })
        .join("\n");
    };
    const diff = suggestionDiff(
      signatures(oldBlocks, previousDefinitions, previous),
      signatures(newBlocks, currentDefinitions, current),
    );
    const changes: { kind: string; node: RootContent; source: string }[] = [];
    let oldIndex = 0;
    let newIndex = 0;
    for (const line of diff ? diff.split("\n") : []) {
      const kind = line[0];
      const node = kind === "-" ? oldBlocks[oldIndex++] : newBlocks[newIndex++];
      if (kind === " ") oldIndex++;
      const last = changes.at(-1);
      if (
        node.type === "list" &&
        last?.node.type === "list" &&
        last.kind === kind &&
        listOrigins.get(last.node) === listOrigins.get(node)
      ) {
        last.node.children.push(...node.children);
        if (last.node.position && node.position) {
          last.node.position = {
            start: last.node.position.start,
            end: node.position.end,
          };
        }
      } else {
        changes.push({ kind, node, source: kind === "-" ? previous : current });
      }
    }
    // Pair adjacent paragraph replacements in source order. Otherwise the last
    // deleted paragraph could be compared with the first added paragraph.
    const pairedChanges: ((typeof changes)[number] & { pair?: boolean })[] = [];
    for (let index = 0; index < changes.length;) {
      if (changes[index].kind !== "-") {
        pairedChanges.push(changes[index++]);
        continue;
      }
      let middle = index;
      while (changes[middle]?.kind === "-") middle++;
      let end = middle;
      while (changes[end]?.kind === "+") end++;
      const removed = changes.slice(index, middle);
      const added = changes.slice(middle, end);
      if (
        removed.length === added.length &&
        [...removed, ...added].every(({ node }) => node.type === "paragraph")
      ) {
        removed.forEach((change, offset) => {
          pairedChanges.push({ ...change, pair: true }, added[offset]);
        });
      } else {
        pairedChanges.push(...changes.slice(index, end));
      }
      index = end;
    }
    const children: RootContent[] = [];
    for (let index = 0; index < pairedChanges.length; index += 1) {
      const { kind, node, source, pair } = pairedChanges[index];
      const next = pairedChanges[index + 1];
      const paragraph =
        pair &&
        kind === "-" &&
        node.type === "paragraph" &&
        next?.kind === "+" &&
        next.node.type === "paragraph"
          ? paragraphDiff(node, next.node)
          : undefined;
      if (paragraph) {
        children.push({
          type: "blockquote",
          children: [paragraph],
          data: {
            hName: "revision-modification",
            hProperties: {
              previousStartLine: node.position?.start.line,
              previousEndLine: node.position?.end.line,
            },
          },
        });
        index += 1;
        continue;
      }
      if (kind === "-") {
        children.push({
          type: "blockquote",
          children: [],
          data: {
            hName: "revision-deletion",
            hProperties: {
              previousStartLine: node.position?.start.line,
              previousEndLine: node.position?.end.line,
              markdown: [
                sourceOf(node, source),
                ...previousDefinitions.map((definition) =>
                  sourceOf(definition, previous),
                ),
              ].join("\n\n"),
            },
          },
        });
      } else if (kind === "+") {
        children.push({
          type: "blockquote",
          children: [node as Blockquote["children"][number]],
          data: { hName: "revision-addition" },
        });
      } else {
        children.push(node);
      }
    }
    tree.children = [...children, ...currentDefinitions];
  };
