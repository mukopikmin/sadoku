import type { RefObject } from "react";
import {
  measureHighlightGroups,
  useHighlightLayouts,
} from "./useHighlightLayouts";

export const measureRevisionHighlightLayouts = (preview: HTMLElement) => {
  const groups: {
    range: { kind: "addition" | "deletion" };
    elements: HTMLElement[];
  }[] = [];
  let previous: typeof groups[number] | undefined;
  // Unchanged blocks break groups, including unchanged nested list items.
  for (const element of preview.querySelectorAll<HTMLElement>(
    "[data-revision-block], [data-revision-kind]",
  )) {
    const kind = element.dataset.revisionKind;
    if (kind !== "addition" && kind !== "deletion") {
      previous = undefined;
      continue;
    }
    if (previous?.range.kind === kind) {
      previous.elements.push(element);
    } else {
      previous = { range: { kind }, elements: [element] };
      groups.push(previous);
    }
  }
  return measureHighlightGroups(preview, groups);
};

export const useRevisionHighlightLayout = (
  previewRef: RefObject<HTMLElement | null>,
) => useHighlightLayouts(previewRef, measureRevisionHighlightLayouts);
