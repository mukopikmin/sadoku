import { useCallback } from "react";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { errorMessage } from "../../models/uiState";
import { toaster } from "../ui/toaster";

type CommentActionOptions = { errorTitle?: string; onSuccess?: () => void };
export type ReportCommentActionError = (error: unknown, title?: string) => void;
export type RunCommentAction = (
  action: () => Promise<void>,
  options?: CommentActionOptions,
) => Promise<boolean>;

export const useCommentActionState = () => {
  const { state, run, reportError: setError } = useAsyncAction();
  const reportError = useCallback<ReportCommentActionError>(
    (error, title = "Comment action failed") => {
      setError(error);
      toaster.create({
        closable: true,
        description: errorMessage(error),
        title,
        type: "error",
      });
    },
    [setError],
  );
  const runAction = useCallback<RunCommentAction>(
    (action, options = {}) =>
      run(
        async () => {
          await action();
          options.onSuccess?.();
        },
        (error) => reportError(error, options.errorTitle),
      ),
    [run, reportError],
  );
  return { state, reportError, runAction };
};
