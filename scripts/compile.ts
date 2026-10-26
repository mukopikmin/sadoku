// Compatibility entry point for release and installer tooling. The shipped
// application is a Go binary; Deno is only used to run repository tooling.
const value = (name: string): string | undefined => {
  const index = Deno.args.indexOf(name);
  if (index === -1) return undefined;
  const result = Deno.args[index + 1];
  if (!result || result.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }
  return result;
};

const targets: Record<string, { GOOS: string; GOARCH: string }> = {
  "aarch64-apple-darwin": { GOOS: "darwin", GOARCH: "arm64" },
  "x86_64-unknown-linux-gnu": { GOOS: "linux", GOARCH: "amd64" },
  "x86_64-pc-windows-msvc": { GOOS: "windows", GOARCH: "amd64" },
  "darwin-arm64": { GOOS: "darwin", GOARCH: "arm64" },
  "linux-x64": { GOOS: "linux", GOARCH: "amd64" },
  "windows-x64": { GOOS: "windows", GOARCH: "amd64" },
};
const target = value("--target");
if (target && !targets[target]) throw new Error(`Unknown target: ${target}`);
const version = value("--version") ?? "0.0.0-dev";
if (!/^[0-9A-Za-z.+-]+$/.test(version)) throw new Error("Invalid version.");
const result = await new Deno.Command("go", {
  args: [
    "build",
    "-trimpath",
    "-ldflags",
    `-s -w -X github.com/mukopikmin/sadoku/src/server/cli.Version=${version}`,
    "-o",
    value("--output") ?? "sadoku",
    "./cmd/sadoku",
  ],
  env: { CGO_ENABLED: "0", ...(target ? targets[target] : {}) },
  stdout: "inherit",
  stderr: "inherit",
}).output();
if (!result.success) Deno.exit(result.code);
