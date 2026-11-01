import { Box } from "@chakra-ui/react";
import type { HighlightLayout } from "./useHighlightLayouts";

export const HighlightOverlay = ({
  layouts,
}: {
  layouts: readonly HighlightLayout[];
}) => (
  <Box aria-hidden="true" className="markdown-range-highlights">
    {layouts.map((layout, index) => (
      <Box
        className={`markdown-range-highlight markdown-range-highlight-${layout.kind}`}
        data-start-line={layout.startLine}
        data-end-line={layout.endLine}
        bg={`highlight.${layout.kind}.bg`}
        height={`${Math.max(0, layout.bottom - layout.top - 2)}px`}
        key={`${layout.kind}-${index}`}
        top={`${layout.top + 1}px`}
      />
    ))}
  </Box>
);
