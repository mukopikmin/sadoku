import {
  Dialog,
  IconButton,
  NativeSelect,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { ThemeMode } from "../models/theme";

type SettingsDialogProps = {
  onOpenChange: (open: boolean) => void;
  onThemeModeChange: (themeMode: ThemeMode) => void;
  open: boolean;
  themeMode: ThemeMode;
};

export const SettingsDialog = ({
  onOpenChange,
  onThemeModeChange,
  open,
  themeMode,
}: SettingsDialogProps) => {
  return (
    <Dialog.Root
      finalFocusEl={() =>
        globalThis.document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open settings"]',
        )}
      initialFocusEl={() =>
        globalThis.document.getElementById("theme-mode") as HTMLSelectElement}
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Settings</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="2">
                <Text as="label" htmlFor="theme-mode" fontWeight="medium">
                  Theme
                </Text>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    autoFocus
                    id="theme-mode"
                    onChange={(event) =>
                      onThemeModeChange(event.currentTarget.value as ThemeMode)}
                    value={themeMode}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Stack>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <IconButton aria-label="Close settings" size="sm" variant="ghost">
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="1em"
                  viewBox="0 0 16 16"
                  width="1em"
                >
                  <path
                    d="m4 4 8 8m0-8-8 8"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </IconButton>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
