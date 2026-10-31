import { CodeBlock } from "@chakra-ui/react";
import { useContext } from "react";
import { MarkdownThemeContext } from "./MarkdownThemeContext";

export const MarkdownCodeBlock = (props: CodeBlock.RootProps) => {
  const theme =
    useContext(MarkdownThemeContext) ??
    (document.documentElement.dataset.theme === "dark" ? "dark" : "default");
  return (
    <CodeBlock.Root
      {...props}
      data-markdown-code-block=""
      defaultColorScheme={theme === "dark" ? "dark" : "light"}
    />
  );
};
