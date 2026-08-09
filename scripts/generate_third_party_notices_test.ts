import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  collectDenoNotices,
  collectNpmNotices,
  render,
  uniqueNotices,
} from "./generate_third_party_notices.ts";

Deno.test("generates JSR and npm notices from lockfiles", async () => {
  const jsr = await collectDenoNotices("scripts/testdata/notices/deno.lock");
  const npm = await collectNpmNotices(
    "scripts/testdata/notices/package-lock.json",
    "scripts/testdata/notices/node_modules",
  );
  const notices = uniqueNotices([...jsr, ...jsr, ...npm]);
  const output = render(notices);

  assertStringIncludes(output, "@hono/hono");
  assertStringIncludes(output, "4.10.1");
  assertStringIncludes(output, "MIT");
  assertStringIncludes(output, "https://github.com/honojs/hono");
  assertEquals(notices.filter(({ name }) => name === "@hono/hono").length, 1);
  assertStringIncludes(output, "@std/assert");
  assertStringIncludes(output, "@std/internal");
  assertStringIncludes(output, "example-package");
  assertStringIncludes(output, "Apache-2.0");
});
