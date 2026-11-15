import { useTextEditor } from "../../hooks/useTextEditor";
import type { RunCommentAction } from "./useCommentActionState";

type Options = {
  body?: string;
  initiallyOpen?: boolean;
  commentId: number;
  disabled: boolean;
  onSubmit: (body: string) => Promise<void>;
  runAction: RunCommentAction;
  errorTitle: string;
  onSaved?: () => void;
};
export const useCommentDraft = ({
  body,
  initiallyOpen,
  commentId,
  disabled,
  onSubmit,
  runAction,
  errorTitle,
  onSaved,
}: Options) =>
  useTextEditor({
    initialValue: body,
    initiallyOpen,
    scope: commentId,
    onSaved,
    onSave: async (draft) =>
      disabled
        ? false
        : runAction(() => onSubmit(draft.trim()), { errorTitle }),
  });
