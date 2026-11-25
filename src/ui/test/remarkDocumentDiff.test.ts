import { expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { remarkDocumentDiff } from "../markdown/remarkDocumentDiff";

it("includes only the first definition used by each deleted block", () => {
  const previous =
    "![diagram][a] and [link][a]\n\nPlain paragraph\n\n[a]: /first\n[a]: /second\n[b]: /unused";
  const tree = unified().use(remarkParse).parse("");
  remarkDocumentDiff({ previous, current: "" })(tree);
  expect(tree.children).toMatchObject([
    {
      data: {
        hProperties: { markdown: "[a]: /first\n\n![diagram][a] and [link][a]" },
      },
    },
    { data: { hProperties: { markdown: "Plain paragraph" } } },
  ]);
});
