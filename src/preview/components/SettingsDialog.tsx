import {
  Dialog,
  Flex,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  Switch,
  TagsInput,
  Text,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import type { CodeWrapMode, ThemeMode } from "../models/theme";

type SettingsDialogProps = {
  codeWrapMode: CodeWrapMode;
  excludedDirectories: string[];
  fontScale: number;
  maxDepth: number;
  maxFiles: number;
  onCodeWrapModeChange: (codeWrapMode: CodeWrapMode) => void;
  onDirectoryLimitsChange: (maxDepth: number, maxFiles: number) => void;
  onExcludedDirectoriesChange: (excludedDirectories: string[]) => void;
  onFontScaleChange: (fontScale: number) => void;
  onOpenChange: (open: boolean) => void;
  onThemeModeChange: (themeMode: ThemeMode) => void;
  open: boolean;
  themeMode: ThemeMode;
};

export const SettingsDialog = ({
  codeWrapMode,
  excludedDirectories,
  fontScale,
  maxDepth,
  maxFiles,
  onCodeWrapModeChange,
  onDirectoryLimitsChange,
  onExcludedDirectoriesChange,
  onFontScaleChange,
  onOpenChange,
  onThemeModeChange,
  open,
  themeMode,
}: SettingsDialogProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [excludedDirectoriesError, setExcludedDirectoriesError] = useState<
    string
  >();
  const isValidExcludedDirectory = (directory: string) =>
    directory.length > 0 && directory !== "." && directory !== ".." &&
    !directory.includes("/") && !directory.includes("\\");
  const fontScales = [0.75, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
  const scaleIndex = fontScales.findIndex((scale) => scale >= fontScale);
  const decreaseScale = fontScales[Math.max(0, scaleIndex - 1)];
  const increaseScale =
    fontScales[Math.min(fontScales.length - 1, scaleIndex + 1)];

  return (
    <Dialog.Root
      finalFocusEl={() =>
        globalThis.document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open settings"]',
        )}
      initialFocusEl={() => contentRef.current}
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content ref={contentRef}>
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
                    <Text fontWeight="medium">Text size</Text>
                    <Text color="fg.muted" fontSize="sm">
                      Adjust text throughout the preview
                    </Text>
                  </Text>
                  <Flex
                    alignItems="center"
                    aria-label="Text size controls"
                    gap="2"
                    role="group"
                  >
                    <IconButton
                      aria-label="Decrease text size"
                      disabled={fontScale <= fontScales[0]}
                      onClick={() => onFontScaleChange(decreaseScale)}
                      size="sm"
                      variant="outline"
                    >
                      −
                    </IconButton>
                    <Text
                      aria-live="polite"
                      minW="12"
                      textAlign="center"
                    >
                      {Math.round(fontScale * 100)}%
                    </Text>
                    <IconButton
                      aria-label="Increase text size"
                      disabled={fontScale >= fontScales.at(-1)!}
                      onClick={() => onFontScaleChange(increaseScale)}
                      size="sm"
                      variant="outline"
                    >
                      +
                    </IconButton>
                  </Flex>
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
                    <Text id="directory-discovery-label" fontWeight="medium">
                      Directory discovery
                    </Text>
                    <Text
                      color="fg.muted"
                      fontSize="sm"
                      id="directory-discovery-description"
                    >
                      Changes apply the next time a directory preview starts
                    </Text>
                  </Text>
                  <Flex
                    aria-describedby="directory-discovery-description"
                    aria-labelledby="directory-discovery-label"
                    direction="column"
                    gap="3"
                    ps="4"
                    role="group"
                  >
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
                    <TagsInput.Root
                      addOnPaste
                      alignItems="start"
                      aria-describedby="excluded-directories-help"
                      blurBehavior="add"
                      display="grid"
                      gap="4"
                      gridTemplateColumns={{
                        base: "1fr",
                        sm: "1fr minmax(0, 15rem)",
                      }}
                      invalid={excludedDirectoriesError !== undefined}
                      onInputValueChange={() =>
                        setExcludedDirectoriesError(undefined)}
                      onValueChange={({ value }) => {
                        setExcludedDirectoriesError(undefined);
                        onExcludedDirectoriesChange(value);
                      }}
                      onValueInvalid={() =>
                        setExcludedDirectoriesError(
                          "Enter a directory name without path separators.",
                        )}
                      sanitizeValue={(value) => value.trim()}
                      validate={({ inputValue }) =>
                        isValidExcludedDirectory(inputValue.trim())}
                      value={excludedDirectories}
                    >
                      <TagsInput.Label
                        alignItems="center"
                        display="flex"
                        minH="10"
                      >
                        Excluded directories
                      </TagsInput.Label>
                      <Flex direction="column" gap="1" minW="0">
                        <TagsInput.Control>
                          <TagsInput.Items />
                          <TagsInput.Input placeholder="Add a directory" />
                        </TagsInput.Control>
                        <TagsInput.HiddenInput />
                        <Text
                          color={excludedDirectoriesError
                            ? "fg.error"
                            : "fg.muted"}
                          fontSize="sm"
                          id="excluded-directories-help"
                        >
                          {excludedDirectoriesError ??
                            "Press Enter or comma to add a name. Names match at every level."}
                        </Text>
                      </Flex>
                    </TagsInput.Root>
                  </Flex>
                </Flex>
              </Flex>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <IconButton
                aria-label="Close settings"
                size="sm"
                variant="ghost"
              >
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
