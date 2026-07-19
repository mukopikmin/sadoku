import { Button, Dialog, Portal } from "@chakra-ui/react";
import { type ComponentProps, type ReactNode, useRef } from "react";

type ConfirmDialogProps = {
  cancelLabel?: string;
  children: ReactNode;
  confirmColorPalette?: ComponentProps<typeof Button>["colorPalette"];
  confirmLabel: string;
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export const ConfirmDialog = ({
  cancelLabel = "Cancel",
  children,
  confirmColorPalette,
  confirmLabel,
  isPending = false,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmDialogProps) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      closeOnEscape={!isPending}
      closeOnInteractOutside={!isPending}
      initialFocusEl={() => cancelButtonRef.current}
      onOpenChange={({ open }) => {
        if (!isPending) onOpenChange(open);
      }}
      open={open}
      role="alertdialog"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.Description>{children}</Dialog.Description>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                autoFocus
                disabled={isPending}
                onClick={() => onOpenChange(false)}
                ref={cancelButtonRef}
                type="button"
                variant="outline"
              >
                {cancelLabel}
              </Button>
              <Button
                colorPalette={confirmColorPalette}
                disabled={isPending}
                loading={isPending}
                loadingText={confirmLabel}
                onClick={() => void onConfirm()}
                type="button"
              >
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
