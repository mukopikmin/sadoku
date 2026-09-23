import { createShikiAdapter } from "@chakra-ui/react";

const languages = [
  "bash",
  "css",
  "diff",
  "html",
  "javascript",
  "json",
  "jsx",
  "kotlin",
  "markdown",
  "plaintext",
  "typescript",
  "tsx",
  "yaml",
] as const;

const themes = {
  dark: "github-dark",
  light: "github-light",
} as const;

let highlighterPromise:
  | ReturnType<
    typeof import("shiki")["createHighlighter"]
  >
  | undefined;

const adapter = createShikiAdapter({
  load: async () => {
    const { createHighlighter } = await import("shiki");
    highlighterPromise ??= createHighlighter({
      langs: [...languages],
      themes: Object.values(themes),
    });
    const highlighter = await highlighterPromise;
    return { codeToHtml: highlighter.codeToHtml.bind(highlighter) };
  },
  theme: themes,
});

export const shikiAdapter = {
  ...adapter,
  getHighlighter: (context: Parameters<typeof adapter.getHighlighter>[0]) => {
    const highlight = adapter.getHighlighter(context);
    return (props: Parameters<typeof highlight>[0]) => {
      try {
        return highlight(props);
      } catch {
        return { code: props.code, highlighted: false };
      }
    };
  },
};
