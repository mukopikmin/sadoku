import type { ComponentProps, ReactNode, RefObject } from "react";
import type { ResolvedPreviewSettings } from "../../models/theme";
import { markdownStyles } from "../../markdown/markdownStyles";
import type { SettingsDialogProps } from "../SettingsDialog";
import { PreviewDialogHost } from "../PreviewDialogHost";
import { PreviewHeader } from "./PreviewHeader";

type Disclosure = { open: boolean; setOpen: (open: boolean) => void };
type Props = {
  children: ReactNode;
  dialogs: {
    documentId?: number;
    documentTags?: ComponentProps<typeof PreviewDialogHost>["documentTags"];
    documentInstructions: Disclosure;
    documentTagsDialog: Disclosure;
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
  header: ComponentProps<typeof PreviewHeader>;
};

export const PreviewLayout = ({ children, dialogs, header }: Props) => (
  <>
    <style>{markdownStyles}</style>
    <PreviewHeader {...header} />
    <PreviewDialogHost {...dialogs} />
    {children}
  </>
);
