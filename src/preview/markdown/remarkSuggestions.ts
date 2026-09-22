import type { Root, RootContent } from "mdast";
import { suggestionDiff } from "./suggestionDiff";

export const remarkSuggestions = (
  { sourceText }: { sourceText?: string } = {},
) =>
(tree: Root) => {
  const visit = (node: Root | RootContent) => {
    if (
      node.type === "code" &&
      (node.lang === "suggest" || node.lang === "suggestion")
    ) {
      node.data ??= {};
      node.data.hProperties ??= {};
      node.data.hProperties["data-code-language-label"] = "suggest";
      node.lang = "diff";
      if (sourceText !== undefined) {
        node.value = suggestionDiff(sourceText, node.value);
      }
    }
    if ("children" in node) node.children.forEach(visit);
  };
  visit(tree);
};
