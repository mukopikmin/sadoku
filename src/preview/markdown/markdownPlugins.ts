import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

type MarkdownAstNode = {
  children?: MarkdownAstNode[];
  data?: {
    hName?: string;
  };
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

const trimHtmlComment = (value: string): string => value.trim();

const preserveUnsupportedSyntax = () => (tree: MarkdownAstNode) => {
  const transformChildren = (parent: MarkdownAstNode) => {
    if (!parent.children) return;
    parent.children = parent.children.map((node) => {
      if (node.type === "html") {
        const value = node.value ?? "";
        const htmlComment = value.match(/^<!--((?:(?!-->)[\s\S])*)-->$/);
        if (htmlComment) {
          return {
            type: "htmlComment",
            children: [{
              type: "text",
              value: trimHtmlComment(htmlComment[1]),
            }],
            data: { hName: "html-comment" },
            position: node.position,
          };
        }
        return parent.type === "root" || parent.type === "blockquote"
          ? {
            type: "paragraph",
            children: [{
              type: "text",
              value,
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
