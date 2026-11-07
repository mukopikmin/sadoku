import { useMemo, useState } from "react";
import { extractTableOfContents } from "../models/tableOfContents";

export const useTableOfContents = (markdown: string) => {
  const items = useMemo(() => extractTableOfContents(markdown), [markdown]);
  const [open, setOpen] = useState(false);
  return {
    state: items.length
      ? { status: "ready" as const, items }
      : { status: "empty" as const },
    open,
    setOpen,
  };
};
