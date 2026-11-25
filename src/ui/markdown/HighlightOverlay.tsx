import { Box } from "@chakra-ui/react";
import type { Ref } from "react";
import type { HighlightLayout } from "./useHighlightLayouts";

const getSelectionAnchorStyle = (layouts: readonly HighlightLayout[]) => {
  const selection = layouts.filter(({ kind }) => kind === "selection");
  if (selection.length === 0) return;
  const top = Math.min(...selection.map((layout) => layout.top));
  const bottom = Math.max(...selection.map((layout) => layout.bottom));
  const left = Math.max(...selection.map((layout) => layout.outsetLeft ?? 0));
  const right = Math.max(...selection.map((layout) => layout.outsetRight ?? 0));
  const inset = (outset: number) =>
    `min(${-outset}px, calc(-1 * var(--chakra-spacing-2)))`;
  return {
    top,
    height: Math.max(0, bottom - top),
    left: inset(left),
    right: inset(right),
  };
};

export const HighlightOverlay = ({
  layouts,
  selectionAnchorRef,
}: {
  layouts: readonly HighlightLayout[];
  selectionAnchorRef?: Ref<HTMLDivElement>;
}) => {
  const selectionAnchorStyle =
    selectionAnchorRef && getSelectionAnchorStyle(layouts);
  return (
    <Box aria-hidden="true" className="markdown-range-highlights">
      {layouts.map((layout, index) => (
        <Box
          className={`markdown-range-highlight markdown-range-highlight-${layout.kind}`}
          data-start-line={layout.startLine}
          data-end-line={layout.endLine}
          bg={`highlight.${layout.kind}.bg`}
          height={`${Math.max(0, layout.bottom - layout.top)}px`}
          key={`${layout.kind}-${index}`}
          style={{
            left: layout.outsetLeft ? -layout.outsetLeft : undefined,
            right: layout.outsetRight ? -layout.outsetRight : undefined,
          }}
          top={`${layout.top}px`}
        />
      ))}
      {selectionAnchorStyle && (
        <Box
          className="markdown-selection-anchor"
          position="absolute"
          ref={selectionAnchorRef}
          style={selectionAnchorStyle}
        />
      )}
    </Box>
  );
};
