import { CloseButton, Dialog, Flex, Portal } from "@chakra-ui/react";
import { useRef } from "react";
import type {
  CodeWrapMode,
  ResolvedPreviewSettings,
  ThemeMode,
} from "../models/theme";
import { AppearanceSettings } from "./settings/AppearanceSettings";
import { DirectoryDiscoverySettings } from "./settings/DirectoryDiscoverySettings";
import { GitHubAccountSettings } from "./settings/GitHubAccountSettings";

export type SettingsDialogProps = {
  onCodeWrapModeChange: (value: CodeWrapMode) => void;
  onDirectoryLimitsChange: (maxDepth: number, maxFiles: number) => void;
  onExcludedDirectoriesChange: (value: string[]) => void;
  onFontScaleChange: (value: number) => void;
  onMarkdownExtensionsChange: (value: string[]) => void;
  onOpenChange: (open: boolean) => void;
  onThemeModeChange: (value: ThemeMode) => void;
  open: boolean;
  settings: ResolvedPreviewSettings;
};

export const SettingsDialog = (
  { open, onOpenChange, settings, ...actions }: SettingsDialogProps,
) => {
  const contentRef = useRef<HTMLDivElement>(null);
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
              <Flex direction="column" gap="4">
                <GitHubAccountSettings enabled={open} />
                <AppearanceSettings
                  codeWrapMode={settings.codeWrap}
                  fontScale={settings.fontScale}
                  onCodeWrapModeChange={actions.onCodeWrapModeChange}
                  onFontScaleChange={actions.onFontScaleChange}
                  onThemeModeChange={actions.onThemeModeChange}
                  themeMode={settings.theme}
                />
                <DirectoryDiscoverySettings
                  excludedDirectories={settings.excludedDirectories}
                  markdownExtensions={settings.markdownExtensions}
                  maxDepth={settings.maxDepth}
                  maxFiles={settings.maxFiles}
                  onDirectoryLimitsChange={actions.onDirectoryLimitsChange}
                  onExcludedDirectoriesChange={actions
                    .onExcludedDirectoriesChange}
                  onMarkdownExtensionsChange={actions
                    .onMarkdownExtensionsChange}
                />
              </Flex>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton aria-label="Close settings" size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
