import { useCallback, useRef, useState } from "react";
import { toaster } from "../ui/toaster";

type CommentActionOptions = {
  errorTitle?: string;
  onSuccess?: () => void;
};

export type ReportCommentActionError = (
  error: unknown,
  title?: string,
) => void;

export type RunCommentAction = (
  action: () => Promise<void>,
  options?: CommentActionOptions,
) => Promise<boolean>;

export const useCommentActionState = () => {
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const isPendingRef = useRef(false);

  const reportError = useCallback<ReportCommentActionError>(
    (error, title = "Comment action failed") => {
      const description = error instanceof Error
        ? error.message
        : String(error);
      setError(description);
      toaster.create({
        closable: true,
        description,
        title,
        type: "error",
      });
    },
    [],
  );

  const runAction = useCallback<RunCommentAction>(
    async (action, options = {}) => {
      if (isPendingRef.current) return false;

      isPendingRef.current = true;
      setIsPending(true);
      setError(undefined);
      try {
        await action();
        options.onSuccess?.();
        return true;
      } catch (error) {
        reportError(error, options.errorTitle);
        return false;
      } finally {
        isPendingRef.current = false;
        setIsPending(false);
      }
    },
    [reportError],
  );

  return { error, isPending, reportError, runAction };
};
