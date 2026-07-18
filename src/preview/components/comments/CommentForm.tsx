import { Button, Flex, Stack, Textarea } from "@chakra-ui/react";
import type { ComponentProps } from "react";
import { submitCommentOnShortcut } from "./commentShortcuts";

export const CommentActionButton = (
  props: ComponentProps<typeof Button>,
) => <Button size="xs" variant="outline" {...props} />;

type CommentFormProps = {
  cancelAriaLabel?: string;
  disabled: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitAriaLabel?: string;
  submitLabel: string;
  textareaAriaLabel?: string;
  value: string;
};

export const CommentForm = ({
  cancelAriaLabel,
  disabled,
  onCancel,
  onChange,
  onSubmit,
  placeholder,
  submitAriaLabel,
  submitLabel,
  textareaAriaLabel,
  value,
}: CommentFormProps) => (
  <Stack gap="2">
    <Textarea
      aria-label={textareaAriaLabel}
      autoFocus
      minH="90px"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) =>
        submitCommentOnShortcut(event, () => {
          onSubmit();
        })}
      placeholder={placeholder}
      value={value}
    />
    <Flex wrap="wrap" gap="2">
      <CommentActionButton
        aria-label={submitAriaLabel}
        disabled={disabled || value.trim() === ""}
        onClick={onSubmit}
        type="button"
      >
        {submitLabel}
      </CommentActionButton>
      <CommentActionButton
        aria-label={cancelAriaLabel}
        disabled={disabled}
        onClick={onCancel}
        type="button"
      >
        Cancel
      </CommentActionButton>
    </Flex>
  </Stack>
);
