import { Dialog, Flex, IconButton, Portal } from "@chakra-ui/react";
import { X } from "lucide-react";
import { useRef } from "react";
import type {
  CodeWrapMode,
  ResolvedPreviewSettings,
  ThemeMode,
} from "../models/theme";
import { AppearanceSettings } from "./settings/AppearanceSettings";
import { DirectoryDiscoverySettings } from "./settings/DirectoryDiscoverySettings";

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
              <IconButton aria-label="Close settings" size="sm" variant="ghost">
                <X aria-hidden="true" />
              </IconButton>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
