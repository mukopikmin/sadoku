import { assertEquals } from "@std/assert";
import { getGitHubAccount } from "./get_github_account.ts";

const encoder = new TextEncoder();

Deno.test("getGitHubAccount returns the authenticated account", async () => {
  let received: readonly string[] = [];
  const result = await getGitHubAccount((args) => {
    received = args;
    return Promise.resolve({
      code: 0,
      stderr: encoder.encode(""),
      stdout: encoder.encode('{"login":"octocat","name":"The Octocat"}'),
    });
  });

  assertEquals(received, ["api", "--hostname", "github.com", "user"]);
  assertEquals(result, {
    account: { login: "octocat", name: "The Octocat" },
    ok: true,
  });
});

Deno.test("getGitHubAccount reports unavailable and invalid accounts", async () => {
  assertEquals(
    await getGitHubAccount(() =>
      Promise.resolve({
        code: 1,
        stderr: encoder.encode("please run gh auth login"),
        stdout: encoder.encode(""),
      })
    ),
    { message: "please run gh auth login", ok: false },
  );
  assertEquals(
    await getGitHubAccount(() =>
      Promise.resolve({
        code: 0,
        stderr: encoder.encode(""),
        stdout: encoder.encode('{"name":"Missing login"}'),
      })
    ),
    { message: "GitHub returned an invalid account.", ok: false },
  );
});
