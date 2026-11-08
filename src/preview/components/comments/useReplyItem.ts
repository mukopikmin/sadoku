import { useState } from "react";
import { useTextEditor } from "../../hooks/useTextEditor";
import { useClipboard } from "../../hooks/useClipboard";
import type { ReplyItemProps } from "./ReplyItem";

export const useReplyItem = ({
  commentId,
  disabled,
  onDelete,
  onUpdate,
  reportError,
  reply,
  runAction,
}: ReplyItemProps) => {
  const editor = useTextEditor({
    initialValue: reply.body,
    initiallyOpen: false,
    scope: reply.id,
    onSave: async (draft) =>
      disabled
        ? false
        : runAction(() => onUpdate(commentId, reply.id, draft.trim())),
  });
  const [deleting, setDeleting] = useState(false);
  const clipboard = useClipboard(reply.body, {
    title: "Reply copied",
    description: "The reply body was copied to the clipboard.",
    onError: (error) => reportError(error),
  });
  const state =
    editor.state.status !== "closed"
      ? editor.state
      : deleting
        ? { status: "confirming-delete" as const }
        : { status: "reading" as const };
  return {
    state,
    change: editor.change,
    cancelEdit: editor.close,
    save: editor.save,
    copy: clipboard.copy,
    edit: () => {
      if (!disabled) {
        setDeleting(false);
        editor.open(reply.body);
      }
    },
    setDeleteOpen: (open: boolean) => {
      if (!disabled) {
        editor.close();
        setDeleting(open);
      }
    },
    confirmDelete: async () => {
      if (disabled || !deleting) return;
      await runAction(() => onDelete(commentId, reply.id), {
        onSuccess: () => setDeleting(false),
      });
    },
  };
};
