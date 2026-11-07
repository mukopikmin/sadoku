import { useCallback, useState } from "react";
import {
  type CommentRange,
  resolveCommentRangeSelection,
} from "./commentRanges";
import type { CommentRangeSelectionOptions } from "./commentRendering";

type SelectionState =
  | { status: "none" }
  | {
      status: "selected" | "composing";
      range: CommentRange;
      anchorLine: number;
    };
export const useCommentSelection = () => {
  const [state, setState] = useState<SelectionState>({ status: "none" });
  const selectCommentRange = useCallback(
    (clickedRange: CommentRange, { extend }: CommentRangeSelectionOptions) => {
      setState((current) => {
        const selected = resolveCommentRangeSelection(
          current.status === "none" ? undefined : current.range,
          clickedRange,
          current.status === "none" ? undefined : current.anchorLine,
          extend,
        );
        return selected.range
          ? {
              status: "selected",
              range: selected.range,
              anchorLine: selected.anchorLine!,
            }
          : { status: "none" };
      });
    },
    [],
  );
  const openCommentForm = useCallback(
    () =>
      setState((current) =>
        current.status === "none"
          ? current
          : { ...current, status: "composing" },
      ),
    [],
  );
  const closeCommentForm = useCallback(() => setState({ status: "none" }), []);
  return { state, selectCommentRange, openCommentForm, closeCommentForm };
};
