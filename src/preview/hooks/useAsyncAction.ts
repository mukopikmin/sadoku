import { useCallback, useRef, useState } from "react";
import { type ActionState, errorMessage } from "../models/uiState";

/** The ref also rejects duplicate calls before React has rendered pending state. */
export const useAsyncAction = () => {
  const [state, setState] = useState<ActionState>({ status: "idle" });
  const pending = useRef(false);
  const reset = useCallback(() => {
    if (!pending.current) setState({ status: "idle" });
  }, []);
  const reportError = useCallback((error: unknown) => {
    setState({ status: "error", message: errorMessage(error) });
  }, []);
  const run = useCallback(
    async (action: () => Promise<void>, onError?: (error: unknown) => void) => {
      if (pending.current) return false;
      pending.current = true;
      setState({ status: "pending" });
      try {
        await action();
        setState({ status: "idle" });
        return true;
      } catch (error) {
        reportError(error);
        onError?.(error);
        return false;
      } finally {
        pending.current = false;
      }
    },
    [reportError],
  );
  return { state, run, reset, reportError };
};
