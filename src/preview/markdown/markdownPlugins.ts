import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

type MarkdownAstNode = {
  children?: MarkdownAstNode[];
  identifier?: string;
  label?: string;
  position?: unknown;
  type: string;
  value?: string;
};

const plainTextFromNode = (node: MarkdownAstNode): string => {
  if (node.value !== undefined) return node.value;
  return node.children?.map(plainTextFromNode).join("") ?? "";
};

const preserveUnsupportedSyntax = () => (tree: MarkdownAstNode) => {
  const transformChildren = (parent: MarkdownAstNode) => {
    if (!parent.children) return;
    parent.children = parent.children.map((node) => {
      if (node.type === "html") {
        return parent.type === "root" || parent.type === "blockquote"
          ? {
            type: "paragraph",
            children: [{
              type: "text",
              value: node.value ?? "",
              position: node.position,
            }],
            position: node.position,
          }
          : { ...node, type: "text" };
      }
      if (node.type === "footnoteReference") {
        return {
          type: "text",
          value: `[^${node.label ?? node.identifier ?? ""}]`,
          position: node.position,
        };
      }
      if (node.type === "footnoteDefinition") {
        return {
          type: "paragraph",
          children: [{
            type: "text",
            value: `[^${node.label ?? node.identifier ?? ""}]: ${
              plainTextFromNode(node)
            }`,
            position: node.position,
          }],
          position: node.position,
        };
      }
      transformChildren(node);
      return node;
    });
  };
  transformChildren(tree);
};

export const sharedMarkdownRehypePlugins = [rehypeHighlight];

export const sharedMarkdownRemarkPlugins = [
  remarkGfm,
  preserveUnsupportedSyntax,
];
