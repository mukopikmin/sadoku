import { useMemo, useState } from "react";
import { createTreeCollection } from "@chakra-ui/react";
import {
  buildTableOfContentsTree,
  extractTableOfContents,
  type TableOfContentsNode,
} from "../models/tableOfContents";

export const useTableOfContents = (markdown: string) => {
  const items = useMemo(() => extractTableOfContents(markdown), [markdown]);
  const collection = useMemo(
    () =>
      createTreeCollection<TableOfContentsNode>({
        nodeToString: (node) => node.text,
        nodeToValue: (node) => `heading:${node.id}`,
        rootNode: buildTableOfContentsTree(items),
      }),
    [items],
  );
  const [open, setOpen] = useState(false);
  return {
    state: items.length
      ? {
          status: "ready" as const,
          collection,
          expandedValue: items.map((item) => `heading:${item.id}`),
        }
      : { status: "empty" as const },
    open,
    setOpen,
    select: (nodes: TableOfContentsNode[]) => {
      const node = nodes[0];
      if (!node) return;
      setOpen(false);
      const hash = `#${encodeURIComponent(node.id)}`;
      if (globalThis.location.hash === hash) {
        globalThis.dispatchEvent(new HashChangeEvent("hashchange"));
      } else {
        globalThis.location.hash = hash;
      }
    },
  };
};
