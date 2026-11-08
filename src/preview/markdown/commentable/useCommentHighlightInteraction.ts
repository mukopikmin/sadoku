import { useState, type FocusEvent, type MouseEvent } from "react";
import type { CommentRange } from "./commentRanges";

const rangeAt = (preview: HTMLElement, target: EventTarget | null) => {
  if (!(target instanceof Element)) return undefined;
  const block = target.closest<HTMLElement>(".commentable-block");
  if (!block || block.closest(".markdown-preview") !== preview)
    return undefined;
  return {
    startLine: Number(block.dataset.sourceLine),
    endLine: Number(block.dataset.sourceEndLine ?? block.dataset.sourceLine),
  };
};

export const useCommentHighlightInteraction = () => {
  const [hovered, setHovered] = useState<CommentRange>();
  const [focused, setFocused] = useState<CommentRange>();
  const update = (
    setRange: typeof setHovered,
    preview: HTMLElement,
    target: EventTarget | null,
  ) => {
    const next = rangeAt(preview, target);
    setRange((current) =>
      current?.startLine === next?.startLine &&
      current?.endLine === next?.endLine
        ? current
        : next,
    );
  };

  return {
    interactionRange: hovered ?? focused,
    interactionProps: {
      onMouseOver: (event: MouseEvent<HTMLElement>) =>
        update(setHovered, event.currentTarget, event.target),
      onMouseOut: (event: MouseEvent<HTMLElement>) =>
        update(setHovered, event.currentTarget, event.relatedTarget),
      onFocus: (event: FocusEvent<HTMLElement>) =>
        update(setFocused, event.currentTarget, event.target),
      onBlur: (event: FocusEvent<HTMLElement>) =>
        update(setFocused, event.currentTarget, event.relatedTarget),
    },
  };
};
