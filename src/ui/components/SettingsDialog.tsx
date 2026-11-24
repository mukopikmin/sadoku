import {
  Alert,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Portal,
} from "@chakra-ui/react";
import { useRef } from "react";
import type { CodeWrapMode, ThemeMode } from "../models/theme";
import type { PreviewSettingsState } from "../hooks/usePreviewSettings";
import { AppearanceSettings } from "./settings/AppearanceSettings";
import { DirectoryDiscoverySettings } from "./settings/DirectoryDiscoverySettings";
import { GitHubAccountSettings } from "./settings/GitHubAccountSettings";
import { useNestedDialog } from "../hooks/useNestedDialog";
import { StatisticsDialog } from "./StatisticsDialog";

export type SettingsDialogProps = {
  onCodeWrapModeChange: (value: CodeWrapMode) => void;
  onDirectoryLimitsChange: (maxDepth: number, maxFiles: number) => void;
  onExcludedDirectoriesChange: (value: string[]) => void;
  onFontScaleChange: (value: number) => void;
  onMarkdownExtensionsChange: (value: string[]) => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onShowHighlightBoundariesChange: (value: boolean) => void;
  onShowHtmlCommentsChange: (value: boolean) => void;
  onThemeModeChange: (value: ThemeMode) => void;
  onWideLayoutChange: (value: boolean) => void;
  onWideTablesChange: (value: boolean) => void;
  open: boolean;
  settingsState: PreviewSettingsState;
};

export const SettingsDialog = ({
  open,
  onOpenChange,
  onRetry,
  settingsState,
  ...actions
}: SettingsDialogProps) => {
  const { settings } = settingsState;
  const contentRef = useRef<HTMLDivElement>(null);
  const statisticsTriggerRef = useRef<HTMLButtonElement>(null);
  const statistics = useNestedDialog(open);
  return (
    <Dialog.Root
      finalFocusEl={() =>
        globalThis.document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open settings"]',
        )
      }
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
                {settingsState.status === "error" && (
                  <Alert.Root status="error">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>
                        {settingsState.operation === "save"
                          ? "Could not save settings"
                          : "Could not load settings"}
                      </Alert.Title>
                      <Alert.Description>
                        {settingsState.message}
                      </Alert.Description>
                    </Alert.Content>
                    <Button size="sm" variant="outline" onClick={onRetry}>
                      Retry
                    </Button>
                  </Alert.Root>
                )}
                <GitHubAccountSettings enabled={open} />
                <AppearanceSettings
                  codeWrapMode={settings.codeWrap}
                  fontScale={settings.fontScale}
                  onCodeWrapModeChange={actions.onCodeWrapModeChange}
                  onFontScaleChange={actions.onFontScaleChange}
                  onThemeModeChange={actions.onThemeModeChange}
                  onWideLayoutChange={actions.onWideLayoutChange}
                  onWideTablesChange={actions.onWideTablesChange}
                  onShowHtmlCommentsChange={actions.onShowHtmlCommentsChange}
                  onShowHighlightBoundariesChange={
                    actions.onShowHighlightBoundariesChange
                  }
                  showHighlightBoundaries={settings.showHighlightBoundaries}
                  showHtmlComments={settings.showHtmlComments}
                  themeMode={settings.theme}
                  wideLayout={settings.wideLayout}
                  wideTables={settings.wideTables}
                />
                <DirectoryDiscoverySettings
                  excludedDirectories={settings.excludedDirectories}
                  markdownExtensions={settings.markdownExtensions}
                  maxDepth={settings.maxDepth}
                  maxFiles={settings.maxFiles}
                  onDirectoryLimitsChange={actions.onDirectoryLimitsChange}
                  onExcludedDirectoriesChange={
                    actions.onExcludedDirectoriesChange
                  }
                  onMarkdownExtensionsChange={
                    actions.onMarkdownExtensionsChange
                  }
                />
                <Button
                  alignSelf="start"
                  onClick={() => statistics.setOpen(true)}
                  ref={statisticsTriggerRef}
                  type="button"
                  variant="outline"
                >
                  Database statistics
                </Button>
                <StatisticsDialog
                  finalFocusRef={statisticsTriggerRef}
                  onOpenChange={statistics.setOpen}
                  open={open && statistics.state.status === "open"}
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
