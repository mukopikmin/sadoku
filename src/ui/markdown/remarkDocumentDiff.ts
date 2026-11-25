import type { Blockquote, Definition, List, Root, RootContent } from "mdast";
import { toMarkdown } from "mdast-util-to-markdown";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { unified } from "unified";
import { suggestionDiff } from "./suggestionDiff";

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
    const indexDefinitions = (root: Root, source: string) => {
      const references = new Map<string, string>();
      const definitions: Definition[] = [];
      const visit = (node: RootContent, nested: boolean) => {
        if (node.type === "definition" && !references.has(node.identifier)) {
          // A definition in a list or quote is document-wide. Serialize it
          // without the container markers before rendering a standalone block.
          references.set(
            node.identifier,
            nested ? toMarkdown(node).trimEnd() : sourceOf(node, source),
          );
          definitions.push(node);
        }
        if ("children" in node)
          node.children.forEach((child) => visit(child, true));
      };
      root.children.forEach((child) => visit(child, false));
      return { references, definitions };
    };
    const dependenciesOf = (
      node: RootContent,
      references: Map<string, string>,
    ) => {
      const dependencies = new Set<string>();
      const visit = (child: RootContent | Root) => {
        if (child.type === "linkReference" || child.type === "imageReference") {
          const definition = references.get(child.identifier);
          if (definition !== undefined) dependencies.add(definition);
        }
        if ("children" in child) child.children.forEach(visit);
      };
      visit(node);
      return [...dependencies];
    };
    const { references: oldReferences } = indexDefinitions(before, previous);
    const { references: currentReferences, definitions: currentDefinitions } =
      indexDefinitions(tree, current);
    const signatures = (
      blocks: RootContent[],
      references: Map<string, string>,
      source: string,
    ) => {
      return blocks
        .map((node) => {
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
            dependenciesOf(node, references),
          ]);
        })
        .join("\n");
    };
    const diff = suggestionDiff(
      signatures(oldBlocks, oldReferences, previous),
      signatures(newBlocks, currentReferences, current),
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
    const children: RootContent[] = [];
    for (const { kind, node, source } of changes) {
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
                ...dependenciesOf(node, oldReferences),
                sourceOf(node, source),
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
    tree.children = [...currentDefinitions, ...children];
  };
