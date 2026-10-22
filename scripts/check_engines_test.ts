import { assertEquals } from "@std/assert";

import { getEngineErrors } from "./check_engines.mjs";

const engines = { node: "^20.2.3", deno: "^2.1.4" };

Deno.test("engine checks accept the minimum and compatible patch and minor releases", () => {
  for (
    const versions of [
      { node: "20.2.3", deno: "2.1.4" },
      { node: "20.2.4", deno: "2.1.5" },
      { node: "20.3.0", deno: "2.2.0" },
    ]
  ) {
    assertEquals(getEngineErrors(engines, versions), []);
  }
});

Deno.test("engine checks reject old, next-major, and prerelease runtimes", () => {
  for (
    const versions of [
      { node: "20.2.2", deno: "2.1.3" },
      { node: "21.0.0", deno: "3.0.0" },
      { node: "20.3.0-rc.1", deno: "2.2.0-rc.1" },
    ]
  ) {
    assertEquals(getEngineErrors(engines, versions), [
      `node ${versions.node} does not satisfy ${engines.node}.`,
      `deno ${versions.deno} does not satisfy ${engines.deno}.`,
    ]);
  }
});

Deno.test("engine checks reject missing requirements and invalid SemVer ranges", () => {
  assertEquals(
    getEngineErrors({ node: "invalid" }, { node: "20.2.3", deno: "2.1.4" }),
    [
      "package.json engines.node must be a valid SemVer range.",
      "package.json engines.deno must be a valid SemVer range.",
    ],
  );
  assertEquals(getEngineErrors(engines, { node: "20.2.3" }), [
    "deno missing does not satisfy ^2.1.4.",
  ]);
});

Deno.test("engine checks support standard SemVer ranges beyond caret syntax", () => {
  assertEquals(
    getEngineErrors(
      { node: ">=20.2.3 <21 || >=22 <23", deno: "~2.1.4" },
      { node: "22.1.0", deno: "2.1.5" },
    ),
    [],
  );
});
