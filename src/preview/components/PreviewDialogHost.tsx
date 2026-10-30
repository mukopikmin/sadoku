import type { RefObject } from "react";
import type { ResolvedPreviewSettings } from "../models/theme";
import type { DocumentTag } from "../models/document";
import type { SettingsDialogProps } from "./SettingsDialog";
import { DocumentInstructionsDialog } from "./DocumentInstructionsDialog";
import { DocumentMemoriesDialog } from "./DocumentMemoriesDialog";
import { DocumentTagsDialog } from "./DocumentTagsDialog";
import { GlobalInstructionsDialog } from "./GlobalInstructionsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { StatisticsDialog } from "./StatisticsDialog";
import { TagsDialog } from "./TagsDialog";

type Disclosure = { open: boolean; setOpen: (open: boolean) => void };
type PreviewDialogHostProps = {
  documentId?: number;
  documentTags?: DocumentTag[];
  documentInstructions: Disclosure;
  documentMemories: Disclosure;
  documentTagsDialog: Disclosure;
  globalInstructions: Disclosure;
  globalInstructionsTriggerRef: RefObject<HTMLButtonElement | null>;
  settings: ResolvedPreviewSettings;
  settingsActions: Omit<
    SettingsDialogProps,
    "open" | "onOpenChange" | "settings"
  >;
  settingsDialog: Disclosure;
  statisticsDialog: Disclosure;
  tagsDialog: Disclosure;
  tagsTriggerRef: RefObject<HTMLButtonElement | null>;
};

export const PreviewDialogHost = ({
  documentId,
  documentTags,
  documentInstructions,
  documentMemories,
  documentTagsDialog,
  globalInstructions,
  globalInstructionsTriggerRef,
  settings,
  settingsActions,
  settingsDialog,
  statisticsDialog,
  tagsDialog,
  tagsTriggerRef,
}: PreviewDialogHostProps) => (
  <>
    <GlobalInstructionsDialog
      finalFocusRef={globalInstructionsTriggerRef}
      onOpenChange={globalInstructions.setOpen}
      open={globalInstructions.open}
    />
    <StatisticsDialog
      onOpenChange={statisticsDialog.setOpen}
      open={statisticsDialog.open}
    />
    <TagsDialog
      finalFocusRef={tagsTriggerRef}
      onOpenChange={tagsDialog.setOpen}
      open={tagsDialog.open}
    />
    {documentId !== undefined && (
      <>
        <DocumentInstructionsDialog
          documentId={documentId}
          onOpenGlobalInstructions={() => {
            documentInstructions.setOpen(false);
            globalInstructions.setOpen(true);
          }}
          onOpenChange={documentInstructions.setOpen}
          open={documentInstructions.open}
        />
        <DocumentMemoriesDialog
          documentId={documentId}
          onOpenChange={documentMemories.setOpen}
          open={documentMemories.open}
        />
        <DocumentTagsDialog
          documentId={documentId}
          onOpenChange={documentTagsDialog.setOpen}
          open={documentTagsDialog.open}
          tags={documentTags ?? []}
        />
      </>
    )}
    <SettingsDialog
      {...settingsActions}
      onOpenChange={settingsDialog.setOpen}
      open={settingsDialog.open}
      settings={settings}
    />
  </>
);
