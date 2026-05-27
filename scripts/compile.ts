const packagePath = new URL("../package.json", import.meta.url);
const hiddenPackagePath = new URL("../package.json.compile-hidden", import.meta.url);

const command = new Deno.Command(Deno.execPath(), {
  args: [
    "compile",
    "--no-check",
    "--allow-read",
    "--allow-net",
    "--include",
    "src/vendor/mermaid/mermaid.esm.min.mjs",
    "--include",
    "src/vendor/mermaid/chunks/mermaid.esm.min",
    "--output",
    "mdview",
    "src/main.ts"
  ],
  stdout: "inherit",
  stderr: "inherit"
});

try {
  await Deno.rename(packagePath, hiddenPackagePath);
  const result = await command.output();
  if (!result.success) {
    Deno.exit(result.code);
  }
} finally {
  await Deno.rename(hiddenPackagePath, packagePath).catch(() => undefined);
}
