#!/usr/bin/env -S deno run --allow-run=go
// Compatibility launcher. All application behavior runs in the Go backend.
const result = await new Deno.Command("go", {
  args: ["run", "./cmd/sadoku", ...Deno.args],
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
}).output();
Deno.exitCode = result.code;
