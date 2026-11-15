import type { Parent, Root } from "mdast";
import type { Plugin } from "unified";

// Keep source positions intact: review comments and document diffs refer to
// the original Markdown, including the marker line.
export const remarkAlerts: Plugin<[], Root> = () => (tree, file) => {
  const source = String(file);
  const visit = (parent: Parent) => {
    for (const node of parent.children) {
      if (node.type === "blockquote") {
        const paragraph = node.children[0];
        const first =
          paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
        const match =
          first?.type === "text"
            ? first.value.match(
                /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/,
              )
            : undefined;
        const offset = first?.position?.start.offset;
        const markerLine =
          offset === undefined ? "" : source.slice(offset).split(/\r?\n/, 1)[0];
        if (
          match &&
          /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\\?$/.test(
            markerLine,
          ) &&
          first?.type === "text" &&
          paragraph?.type === "paragraph"
        ) {
          node.data = {
            ...node.data,
            hProperties: {
              ...node.data?.hProperties,
              "data-markdown-alert": match[1],
            },
          };
          first.value = first.value.slice(match[0].length);
          if (!first.value) paragraph.children.shift();
          // A Markdown hard break on the marker line is only a separator.
          if (paragraph.children[0]?.type === "break")
            paragraph.children.shift();
          if (!paragraph.children.length) node.children.shift();
        }
      }
      if ("children" in node) visit(node);
    }
  };
  visit(tree);
};
