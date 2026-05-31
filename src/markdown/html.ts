import hljs from "highlight.js/core";
import bash from "highlight.js/languages/bash";
import cpp from "highlight.js/languages/cpp";
import csharp from "highlight.js/languages/csharp";
import css from "highlight.js/languages/css";
import diff from "highlight.js/languages/diff";
import go from "highlight.js/languages/go";
import java from "highlight.js/languages/java";
import javascript from "highlight.js/languages/javascript";
import json from "highlight.js/languages/json";
import kotlin from "highlight.js/languages/kotlin";
import markdown from "highlight.js/languages/markdown";
import php from "highlight.js/languages/php";
import python from "highlight.js/languages/python";
import ruby from "highlight.js/languages/ruby";
import rust from "highlight.js/languages/rust";
import sql from "highlight.js/languages/sql";
import typescript from "highlight.js/languages/typescript";
import xml from "highlight.js/languages/xml";
import yaml from "highlight.js/languages/yaml";
// @ts-ignore esm.sh provides a default export; the upstream DefinitelyTyped package uses export =.
import MarkdownIt from "markdown-it";

type RenderEnv = {
  headingSlugs?: Map<string, number>;
};

type RendererRule = (
  tokens: Array<{ tag: string; content: string; info: string }>,
  index: number,
  options: unknown,
  env: RenderEnv,
  self: { renderToken: RendererRule },
) => string;

type MarkdownToken = {
  attrJoin?: (name: string, value: string) => void;
  children?: MarkdownToken[];
  content: string;
  type: string;
};

type TaskListState = {
  Token: new (type: string, tag: string, nesting: number) => MarkdownToken;
  tokens: MarkdownToken[];
};

type TaskListMarkdown = {
  core: {
    ruler: {
      after: (
        afterName: string,
        ruleName: string,
        rule: (state: TaskListState) => void,
      ) => void;
    };
  };
};

const registerLanguage = (name: string, language: unknown) =>
  hljs.registerLanguage(
    name,
    language as Parameters<typeof hljs.registerLanguage>[1],
  );

registerLanguage("bash", bash);
registerLanguage("cpp", cpp);
registerLanguage("csharp", csharp);
registerLanguage("css", css);
registerLanguage("diff", diff);
registerLanguage("go", go);
registerLanguage("java", java);
registerLanguage("javascript", javascript);
registerLanguage("json", json);
registerLanguage("kotlin", kotlin);
registerLanguage("markdown", markdown);
registerLanguage("php", php);
registerLanguage("python", python);
registerLanguage("ruby", ruby);
registerLanguage("rust", rust);
registerLanguage("sql", sql);
registerLanguage("typescript", typescript);
registerLanguage("xml", xml);
registerLanguage("yaml", yaml);
hljs.registerAliases(["js", "jsx"], { languageName: "javascript" });
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
hljs.registerAliases(["sh", "shell", "zsh"], { languageName: "bash" });
hljs.registerAliases(["md"], { languageName: "markdown" });
hljs.registerAliases(["yml"], { languageName: "yaml" });

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string =>
  escapeHtml(value).replaceAll("`", "&#96;");

const slugifyHeading = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug || "heading";
};

const headingId = (text: string, env: RenderEnv): string => {
  env.headingSlugs ??= new Map();

  const slug = slugifyHeading(text);
  const count = env.headingSlugs.get(slug) ?? 0;
  env.headingSlugs.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count}`;
};

const trimFinalNewline = (value: string): string => value.replace(/\n$/, "");

const applyTaskListRule = (markdown: TaskListMarkdown): void => {
  markdown.core.ruler.after(
    "inline",
    "task_list_items",
    (state: TaskListState) => {
      const tokens = state.tokens;

      for (let index = 0; index < tokens.length; index += 1) {
        const listItemToken = tokens[index];
        if (listItemToken.type !== "list_item_open") continue;

        let inlineTokenIndex = -1;
        for (
          let tokenIndex = index + 1;
          tokenIndex < tokens.length;
          tokenIndex += 1
        ) {
          const token = tokens[tokenIndex];
          if (token.type === "list_item_close") break;
          if (token.type === "inline") {
            inlineTokenIndex = tokenIndex;
            break;
          }
        }
        if (inlineTokenIndex === -1) continue;

        const inlineToken = tokens[inlineTokenIndex];
        const taskMarker = inlineToken.content.match(/^\[([ xX])\]\s+/);
        if (!taskMarker) continue;

        const checked = taskMarker[1].toLowerCase() === "x";
        listItemToken.attrJoin?.("class", "task-list-item");
        inlineToken.content = inlineToken.content.slice(taskMarker[0].length);

        const textToken = inlineToken.children?.find((child: MarkdownToken) =>
          child.type === "text"
        );
        if (textToken) {
          textToken.content = textToken.content.slice(taskMarker[0].length);
        }

        const checkboxToken = new state.Token("html_inline", "", 0);
        checkboxToken.content =
          `<input class="task-list-item-checkbox" type="checkbox" disabled${
            checked ? " checked" : ""
          }> `;
        inlineToken.children?.unshift(checkboxToken);
      }
    },
  );
};

const renderHighlightedCode = (code: string, language: string | undefined) => {
  const languageClass = language
    ? ` class="hljs language-${escapeAttribute(language)}"`
    : ' class="hljs"';

  if (!language || !hljs.getLanguage(language)) {
    return `<pre><code${languageClass}>${escapeHtml(code)}</code></pre>\n`;
  }

  const highlighted = hljs.highlight(code, {
    language,
    ignoreIllegals: true,
  }).value;
  return `<pre><code${languageClass}>${highlighted}</code></pre>\n`;
};

const createMarkdownRenderer = (): MarkdownIt => {
  const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
  });
  applyTaskListRule(markdown as unknown as TaskListMarkdown);
  markdown.renderer.rules.heading_open = ((tokens, index, _options, env) => {
    const token = tokens[index];
    const inlineToken = tokens[index + 1];
    const id = headingId(inlineToken?.content ?? "", env);
    const escapedId = escapeAttribute(id);
    return `<${token.tag} id="${escapedId}"><a class="heading-anchor" href="#${escapedId}">`;
  }) as RendererRule;

  markdown.renderer.rules.heading_close =
    ((tokens, index) => `</a></${tokens[index].tag}>\n`) as RendererRule;

  markdown.renderer.rules.s_open = (() => "<del>") as RendererRule;
  markdown.renderer.rules.s_close = (() => "</del>") as RendererRule;

  markdown.renderer.rules.fence = ((tokens, index) => {
    const token = tokens[index];
    const language = token.info.trim().split(/\s+/, 1)[0]?.toLowerCase();
    const code = trimFinalNewline(token.content);

    if (language === "mermaid") {
      return `<pre class="mermaid">${escapeHtml(code)}</pre>\n`;
    }

    return renderHighlightedCode(code, language);
  }) as RendererRule;

  return markdown;
};

const renderer = createMarkdownRenderer();

export const renderMarkdown = (markdown: string): string =>
  renderer.render(markdown, { headingSlugs: new Map() }).trimEnd();
