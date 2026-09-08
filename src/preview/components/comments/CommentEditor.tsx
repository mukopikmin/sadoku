import { useState } from "react";
import { CommentForm } from "./CommentForm";
import type { RunCommentAction } from "./useCommentActionState";

type CommentEditorProps = {
  body: string;
  commentId: number;
  disabled: boolean;
  onClose: () => void;
  onUpdate: (id: number, body: string) => Promise<void>;
  runAction: RunCommentAction;
};

export const CommentEditor = ({
  body,
  commentId,
  disabled,
  onClose,
  onUpdate,
  runAction,
}: CommentEditorProps) => {
  const [draft, setDraft] = useState(body);

  const handleSubmit = async () => {
    const updatedBody = draft.trim();
    if (!updatedBody || disabled) return;
    await runAction(() => onUpdate(commentId, updatedBody), {
      errorTitle: "Could not update comment",
      onSuccess: onClose,
    });
  };

  return (
    <CommentForm
      disabled={disabled}
      onCancel={onClose}
      onChange={setDraft}
      onSubmit={() => void handleSubmit()}
      submitLabel="Save"
      value={draft}
    />
  );
};
