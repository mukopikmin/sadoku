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
import type { DirectoryListing } from "../api/settings";

type SettingsDialogProps = {
  codeWrapMode: CodeWrapMode;
  defaultDirectory: string;
  onCodeWrapModeChange: (codeWrapMode: CodeWrapMode) => void;
  onDefaultDirectoryChange: (defaultDirectory: string) => void;
  onLoadDirectories: (path?: string) => Promise<DirectoryListing>;
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
  onLoadDirectories,
  onThemeModeChange,
  open,
  themeMode,
}: SettingsDialogProps) => {
  const [directoryInput, setDirectoryInput] = useState(defaultDirectory);
  const [directoryPickerError, setDirectoryPickerError] = useState<string>();
  const [directoryPickerPending, setDirectoryPickerPending] = useState(false);
  const [directoryListing, setDirectoryListing] = useState<DirectoryListing>();

  useEffect(() => setDirectoryInput(defaultDirectory), [defaultDirectory]);

  const loadPickerDirectory = async (path?: string) => {
    setDirectoryPickerError(undefined);
    setDirectoryPickerPending(true);
    try {
      setDirectoryListing(await onLoadDirectories(path));
    } catch (error) {
      setDirectoryPickerError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDirectoryPickerPending(false);
    }
  };

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
                      onClick={() =>
                        loadPickerDirectory(directoryInput || undefined)}
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
                  {directoryListing && (
                    <Flex
                      borderColor="border"
                      borderRadius="md"
                      borderWidth="1px"
                      direction="column"
                      gap="2"
                      padding="3"
                    >
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        wordBreak="break-all"
                      >
                        {directoryListing.path}
                      </Text>
                      <Flex gap="2">
                        <Button
                          disabled={!directoryListing.parent}
                          onClick={() =>
                            loadPickerDirectory(directoryListing.parent)}
                          size="sm"
                          variant="outline"
                        >
                          Up
                        </Button>
                        <Button
                          onClick={() => {
                            setDirectoryInput(directoryListing.path);
                            setDirectoryListing(undefined);
                          }}
                          size="sm"
                        >
                          Select this folder
                        </Button>
                        <Button
                          onClick={() => setDirectoryListing(undefined)}
                          size="sm"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </Flex>
                      <Flex
                        direction="column"
                        maxHeight="48"
                        overflowY="auto"
                      >
                        {directoryListing.directories.length === 0
                          ? (
                            <Text color="fg.muted" fontSize="sm">
                              No subfolders.
                            </Text>
                          )
                          : directoryListing.directories.map((directory) => (
                            <Button
                              justifyContent="flex-start"
                              key={directory.path}
                              onClick={() =>
                                loadPickerDirectory(directory.path)}
                              size="sm"
                              variant="ghost"
                            >
                              {directory.name}
                            </Button>
                          ))}
                      </Flex>
                    </Flex>
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
