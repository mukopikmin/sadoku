import { useRef, useState, type MouseEvent } from "react";
import type { CommentActions } from "../../api/commentActions";
import { errorMessage } from "../../models/uiState";
import type { CommentRange } from "./commentRanges";
import {
  hasTextSelectionWithin,
  useCommentRenderingContext,
  type CommentRangeSelectionOptions,
} from "./commentRendering";

type ComposerState =
  | { status: "editing" | "saving"; draft: string }
  | { status: "error"; draft: string; message: string };

type Options = {
  actions: CommentActions;
  sourceRange: CommentRange;
  activeRange?: CommentRange;
  selectedRange?: CommentRange;
  headingId?: string;
  onCloseCommentForm: () => void;
  onSelectCommentRange: (
    range: CommentRange,
    options: CommentRangeSelectionOptions,
  ) => void;
};

const suggestionBody = (replacement: string) => {
  const longest = Math.max(
    0,
    ...[...replacement.matchAll(/`+/g)].map((match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}suggest\n${replacement}\n${fence}`;
};

export const useCommentComposer = ({
  actions,
  sourceRange,
  activeRange,
  selectedRange,
  headingId,
  onCloseCommentForm,
  onSelectCommentRange,
}: Options) => {
  const { markdown, drafts } = useCommentRenderingContext();
  const [state, setState] = useState<ComposerState>(() => ({
    status: "editing",
    draft: drafts?.get(sourceRange.startLine) ?? "",
  }));
  const pending = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRange = activeRange ?? selectedRange ?? sourceRange;
  const change = (draft: string) => {
    if (pending.current) return;
    if (draft) drafts?.set(sourceRange.startLine, draft);
    else drafts?.delete(sourceRange.startLine);
    setState({ status: "editing", draft });
  };
  const create = async () => {
    const body = state.draft.trim();
    if (!body || pending.current) return;
    pending.current = true;
    setState({ status: "saving", draft: state.draft });
    try {
      await actions.onCreateComment(
        pendingRange.startLine,
        body,
        pendingRange.endLine,
      );
      drafts?.delete(sourceRange.startLine);
      setState({ status: "editing", draft: "" });
      onCloseCommentForm();
    } catch (error) {
      setState({
        status: "error",
        draft: state.draft,
        message: errorMessage(error),
      });
    } finally {
      pending.current = false;
    }
  };
  return {
    state,
    pendingRange,
    textareaRef,
    change,
    create,
    insertSuggestion: () => {
      if (pending.current) return;
      const selected = markdown
        .split(/\r?\n/)
        .slice(pendingRange.startLine - 1, pendingRange.endLine)
        .join("\n");
      change(
        `${state.draft}${state.draft ? "\n\n" : ""}${suggestionBody(selected)}`,
      );
      textareaRef.current?.focus();
    },
    contentClick: (event: MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest("button, input, label, select, textarea")
      )
        return;
      const link = target.closest("a");
      if (!event.shiftKey && hasTextSelectionWithin(event.currentTarget)) {
        if (link?.classList.contains("heading-anchor")) event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (link && !link.classList.contains("heading-anchor")) return;
      if (link) event.preventDefault();
      onSelectCommentRange(sourceRange, { extend: event.shiftKey });
      event.stopPropagation();
    },
    setHeadingLink: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (headingId) globalThis.location.hash = headingId;
    },
  };
};
