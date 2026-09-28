const result = await new Deno.Command("git", {
  args: [
    "status",
    "--short",
    "--untracked-files=all",
    "--",
    "gen/ts",
  ],
  stdout: "piped",
  stderr: "inherit",
}).output();

if (!result.success) {
  Deno.exit(result.code);
}

const changes = new TextDecoder().decode(result.stdout).trimEnd();
if (changes.length > 0) {
  console.error("Generated protobuf code is not up to date:");
  console.error(changes);
  console.error("Run `npm run proto:generate` and commit the result.");
  Deno.exit(1);
}
