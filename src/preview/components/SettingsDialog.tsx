import {
  Dialog,
  Flex,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  Switch,
  Text,
} from "@chakra-ui/react";
import type { CodeWrapMode, ThemeMode } from "../models/theme";

type SettingsDialogProps = {
  codeWrapMode: CodeWrapMode;
  maxDepth: number;
  maxFiles: number;
  onCodeWrapModeChange: (codeWrapMode: CodeWrapMode) => void;
  onDirectoryLimitsChange: (maxDepth: number, maxFiles: number) => void;
  onOpenChange: (open: boolean) => void;
  onThemeModeChange: (themeMode: ThemeMode) => void;
  open: boolean;
  themeMode: ThemeMode;
};

export const SettingsDialog = ({
  codeWrapMode,
  maxDepth,
  maxFiles,
  onCodeWrapModeChange,
  onDirectoryLimitsChange,
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
                <Flex direction="column" gap="3">
                  <Text as="div">
                    <Text fontWeight="medium">Directory discovery</Text>
                    <Text color="fg.muted" fontSize="sm">
                      Changes apply the next time a directory preview starts.
                    </Text>
                  </Text>
                  <Flex
                    alignItems="center"
                    justifyContent="space-between"
                    gap="4"
                  >
                    <Text as="label" htmlFor="directory-max-depth">
                      Maximum depth
                    </Text>
                    <Input
                      id="directory-max-depth"
                      min="0"
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (Number.isInteger(value) && value >= 0) {
                          onDirectoryLimitsChange(value, maxFiles);
                        }
                      }}
                      type="number"
                      value={maxDepth}
                      width="24"
                    />
                  </Flex>
                  <Flex
                    alignItems="center"
                    justifyContent="space-between"
                    gap="4"
                  >
                    <Text as="label" htmlFor="directory-max-files">
                      Maximum files
                    </Text>
                    <Input
                      id="directory-max-files"
                      min="1"
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (Number.isInteger(value) && value >= 1) {
                          onDirectoryLimitsChange(maxDepth, value);
                        }
                      }}
                      type="number"
                      value={maxFiles}
                      width="24"
                    />
                  </Flex>
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
