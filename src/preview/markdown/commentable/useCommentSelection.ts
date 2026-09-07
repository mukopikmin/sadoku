import { useCallback, useState } from "react";
import {
  type CommentRange,
  type CommentRangeSelection,
  resolveCommentRangeSelection,
} from "./commentRanges";
import type { CommentRangeSelectionOptions } from "./commentRendering";

export const useCommentSelection = () => {
  const [activeCommentLine, setActiveCommentLine] = useState<number>();
  const [activeRange, setActiveRange] = useState<CommentRange>();
  const [selection, setSelection] = useState<CommentRangeSelection>({});
  const selectedRange = selection.range;

  const selectCommentRange = useCallback((
    clickedRange: CommentRange,
    { extend }: CommentRangeSelectionOptions,
  ) => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelection((current) =>
      resolveCommentRangeSelection(
        current.range,
        clickedRange,
        current.anchorLine,
        extend,
      )
    );
  }, []);

  const openCommentForm = useCallback(() => {
    if (!selectedRange) return;
    setActiveCommentLine(selectedRange.endLine);
    setActiveRange(selectedRange);
  }, [selectedRange]);

  const closeCommentForm = useCallback(() => {
    setActiveCommentLine(undefined);
    setActiveRange(undefined);
    setSelection({});
  }, []);

  return {
    activeCommentLine,
    activeRange,
    closeCommentForm,
    openCommentForm,
    selectCommentRange,
    selectedRange,
  };
};
