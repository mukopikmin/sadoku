import type { ComponentProps, ReactNode } from "react";
import { markdownStyles } from "../../markdown/markdownStyles";
import { PreviewDialogHost } from "../PreviewDialogHost";
import { PreviewHeader } from "./PreviewHeader";

type Props = {
  children: ReactNode;
  dialogs: ComponentProps<typeof PreviewDialogHost>;
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
