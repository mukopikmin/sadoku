import { Button, CloseButton, Dialog, Flex, Portal } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type {
  CodeWrapMode,
  ResolvedPreviewSettings,
  ThemeMode,
} from "../models/theme";
import { AppearanceSettings } from "./settings/AppearanceSettings";
import { DirectoryDiscoverySettings } from "./settings/DirectoryDiscoverySettings";
import { GitHubAccountSettings } from "./settings/GitHubAccountSettings";
import { StatisticsDialog } from "./StatisticsDialog";

export type SettingsDialogProps = {
  onCodeWrapModeChange: (value: CodeWrapMode) => void;
  onDirectoryLimitsChange: (maxDepth: number, maxFiles: number) => void;
  onExcludedDirectoriesChange: (value: string[]) => void;
  onFontScaleChange: (value: number) => void;
  onMarkdownExtensionsChange: (value: string[]) => void;
  onOpenChange: (open: boolean) => void;
  onShowHighlightBoundariesChange: (value: boolean) => void;
  onShowHtmlCommentsChange: (value: boolean) => void;
  onThemeModeChange: (value: ThemeMode) => void;
  open: boolean;
  settings: ResolvedPreviewSettings;
};

export const SettingsDialog = (
  { open, onOpenChange, settings, ...actions }: SettingsDialogProps,
) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const statisticsTriggerRef = useRef<HTMLButtonElement>(null);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  useEffect(() => {
    if (!open) setStatisticsOpen(false);
  }, [open]);
  return (
    <Dialog.Root
      finalFocusEl={() =>
        globalThis.document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open settings"]',
        )}
      initialFocusEl={() => contentRef.current}
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
      scrollBehavior="inside"
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
                  onShowHtmlCommentsChange={actions.onShowHtmlCommentsChange}
                  onShowHighlightBoundariesChange={actions
                    .onShowHighlightBoundariesChange}
                  showHighlightBoundaries={settings.showHighlightBoundaries}
                  showHtmlComments={settings.showHtmlComments}
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
                <Button
                  alignSelf="start"
                  onClick={() => setStatisticsOpen(true)}
                  ref={statisticsTriggerRef}
                  type="button"
                  variant="outline"
                >
                  Database statistics
                </Button>
                <StatisticsDialog
                  finalFocusRef={statisticsTriggerRef}
                  onOpenChange={setStatisticsOpen}
                  open={open && statisticsOpen}
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
