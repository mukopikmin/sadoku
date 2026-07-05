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

Deno.test("loads the preview stylesheet before the client script", () => {
  const html = renderSpaShell("Preview");

  assertStringIncludes(
    html,
    '<link rel="stylesheet" href="/assets/sadoku-preview-client.css">',
  );
  assertEquals(
    html.indexOf("/assets/sadoku-preview-client.css") <
      html.indexOf("/assets/client.js"),
    true,
  );
});
