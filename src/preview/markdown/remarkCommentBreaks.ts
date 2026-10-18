import type { Parent, Root, RootContent } from "mdast";

export const remarkCommentBreaks = () => (tree: Root) => {
  const transform = (parent: Parent) => {
    parent.children = parent.children.flatMap((node): RootContent[] => {
      if ("children" in node) transform(node);
      if (node.type !== "text") return [node];

      return node.value.split(/\r\n|\r|\n/).flatMap(
        (value, index): RootContent[] =>
          index === 0
            ? [{ type: "text", value }]
            : [{ type: "break" }, { type: "text", value }],
      );
    });
  };
  transform(tree);
};
