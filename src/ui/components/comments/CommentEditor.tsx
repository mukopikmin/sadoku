import { useCommentDraft } from "./useCommentDraft";
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
  const editor = useCommentDraft({
    body,
    commentId,
    disabled,
    runAction,
    onSubmit: (draft) => onUpdate(commentId, draft),
    errorTitle: "Could not update comment",
    onSaved: onClose,
  });

  return (
    <CommentForm
      disabled={disabled || editor.state.status === "saving"}
      onCancel={onClose}
      onChange={editor.change}
      onSubmit={() => void editor.save()}
      submitLabel="Save"
      value={editor.state.status === "closed" ? "" : editor.state.draft}
    />
  );
};
