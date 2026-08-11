import { assertEquals, assertStringIncludes } from "@std/assert";

import { renderSpaShell } from "./shell.ts";

Deno.test("escapes all HTML-sensitive characters in the SPA title", () => {
  const html = renderSpaShell(`<&>"' title`);

  assertStringIncludes(
    html,
    "<title>&lt;&amp;&gt;&quot;&#39; title</title>",
  );
  assertEquals(html.includes(`<title><&>"' title</title>`), false);
});

Deno.test("links preview icons in the SPA head", () => {
  const html = renderSpaShell("Preview");

  assertStringIncludes(
    html,
    '<link rel="icon" href="/assets/favicon.ico" sizes="any">',
  );
  assertStringIncludes(
    html,
    '<link rel="apple-touch-icon" href="/assets/icon-512.png">',
  );
});
