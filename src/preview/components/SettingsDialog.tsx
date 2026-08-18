import {
  Button,
  Dialog,
  Flex,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  Switch,
  Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { CodeWrapMode, ThemeMode } from "../models/theme";

type SettingsDialogProps = {
  codeWrapMode: CodeWrapMode;
  defaultDirectory: string;
  onCodeWrapModeChange: (codeWrapMode: CodeWrapMode) => void;
  onDefaultDirectoryChange: (defaultDirectory: string) => void;
  onSelectDirectory: () => Promise<string | undefined>;
  onOpenChange: (open: boolean) => void;
  onThemeModeChange: (themeMode: ThemeMode) => void;
  open: boolean;
  themeMode: ThemeMode;
};

export const SettingsDialog = ({
  codeWrapMode,
  defaultDirectory,
  onCodeWrapModeChange,
  onDefaultDirectoryChange,
  onOpenChange,
  onSelectDirectory,
  onThemeModeChange,
  open,
  themeMode,
}: SettingsDialogProps) => {
  const [directoryInput, setDirectoryInput] = useState(defaultDirectory);
  const [directoryPickerError, setDirectoryPickerError] = useState<string>();
  const [directoryPickerPending, setDirectoryPickerPending] = useState(false);

  useEffect(() => setDirectoryInput(defaultDirectory), [defaultDirectory]);

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
              <Flex
                direction="column"
                gap="4"
              >
                <Flex
                  alignItems="center"
                  justifyContent="space-between"
                  gap="4"
                >
                  <Text as="label" htmlFor="theme-mode" fontWeight="medium">
                    Theme
                  </Text>
                  <NativeSelect.Root width="40">
                    <NativeSelect.Field
                      autoFocus
                      id="theme-mode"
                      onChange={(event) =>
                        onThemeModeChange(
                          event.currentTarget.value as ThemeMode,
                        )}
                      value={themeMode}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Flex>
                <Flex
                  alignItems="center"
                  justifyContent="space-between"
                  gap="4"
                >
                  <Text as="div">
                    <Text fontWeight="medium">Wrap code blocks</Text>
                    <Text color="fg.muted" fontSize="sm">
                      Allow long lines to wrap instead of scrolling horizontally
                    </Text>
                  </Text>
                  <Switch.Root
                    checked={codeWrapMode === "wrap"}
                    onCheckedChange={({ checked }) =>
                      onCodeWrapModeChange(checked ? "wrap" : "scroll")}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Label srOnly>Wrap code blocks</Switch.Label>
                  </Switch.Root>
                </Flex>
                <Flex direction="column" gap="2">
                  <Text
                    as="label"
                    htmlFor="default-directory"
                    fontWeight="medium"
                  >
                    Default folder
                  </Text>
                  <Text color="fg.muted" fontSize="sm">
                    Used when sadoku start is run without a file or folder.
                  </Text>
                  <Flex gap="2">
                    <Input
                      id="default-directory"
                      onChange={(event) =>
                        setDirectoryInput(event.currentTarget.value)}
                      placeholder="/path/to/markdown"
                      value={directoryInput}
                    />
                    <Button
                      onClick={async () => {
                        setDirectoryPickerError(undefined);
                        setDirectoryPickerPending(true);
                        try {
                          const selected = await onSelectDirectory();
                          if (selected !== undefined) {
                            setDirectoryInput(selected);
                          }
                        } catch (error) {
                          setDirectoryPickerError(
                            error instanceof Error
                              ? error.message
                              : String(error),
                          );
                        } finally {
                          setDirectoryPickerPending(false);
                        }
                      }}
                      loading={directoryPickerPending}
                      variant="outline"
                    >
                      Browse…
                    </Button>
                    <Button
                      disabled={directoryInput === defaultDirectory}
                      onClick={() => onDefaultDirectoryChange(directoryInput)}
                    >
                      Save
                    </Button>
                  </Flex>
                  {directoryPickerError && (
                    <Text color="fg.error" fontSize="sm" role="alert">
                      {directoryPickerError}
                    </Text>
                  )}
                </Flex>
              </Flex>
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
