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

const createMarkdownRenderer = (): MarkdownIt => {
  const markdown = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
  });
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

    const languageClass = language
      ? ` class="language-${escapeAttribute(language)}"`
      : "";
    return `<pre><code${languageClass}>${escapeHtml(code)}</code></pre>\n`;
  }) as RendererRule;

  return markdown;
};

const renderer = createMarkdownRenderer();

export const renderMarkdown = (markdown: string): string =>
  renderer.render(markdown, { headingSlugs: new Map() }).trimEnd();
