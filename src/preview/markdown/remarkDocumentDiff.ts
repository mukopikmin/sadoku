import type { Blockquote, Root, RootContent } from "mdast";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { unified } from "unified";
import { suggestionDiff } from "./suggestionDiff";

const parser = unified().use(remarkParse).use(remarkGfm);

const sourceOf = (node: RootContent, source: string) =>
  source.slice(node.position?.start.offset, node.position?.end.offset);

// Compare complete Markdown blocks so tables, lists and fenced code stay valid.
// Retain current node positions: comments always refer to the current source.
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
    const oldBlocks = before.children.filter(
      (node) => node.type !== "definition",
    );
    const newBlocks = tree.children.filter(
      (node) => node.type !== "definition",
    );
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
          return JSON.stringify([
            sourceOf(node, source).replaceAll("\r\n", "\n"),
            dependencies,
          ]);
        })
        .join("\n");
    };
    const diff = suggestionDiff(
      signatures(oldBlocks, previousDefinitions, previous),
      signatures(newBlocks, currentDefinitions, current),
    );
    const children: RootContent[] = [];
    let oldIndex = 0;
    let newIndex = 0;
    for (const line of diff ? diff.split("\n") : []) {
      if (line.startsWith("-")) {
        const node = oldBlocks[oldIndex++];
        children.push({
          type: "blockquote",
          children: [],
          data: {
            hName: "revision-deletion",
            hProperties: {
              markdown: [
                sourceOf(node, previous),
                ...previousDefinitions.map((definition) =>
                  sourceOf(definition, previous),
                ),
              ].join("\n\n"),
            },
          },
        });
      } else if (line.startsWith("+")) {
        children.push({
          type: "blockquote",
          children: [newBlocks[newIndex++] as Blockquote["children"][number]],
          data: { hName: "revision-addition" },
        });
      } else {
        oldIndex++;
        children.push(newBlocks[newIndex++]);
      }
    }
    tree.children = [...children, ...currentDefinitions];
  };
